import express, { Request, Response } from 'express';
import { randomUUID } from "node:crypto";
import { Client } from "@googlemaps/google-maps-services-js";
import { z } from 'zod';

// Initialize Google Maps client
const client = new Client({});

// Create Express application
const app = express();
app.use(express.json());

// Store active sessions
const sessions: Record<string, any> = {};

// Geocoding tool schema
const geocodeSchema = z.object({
  address: z.string().describe('The address to geocode'),
});

// Places search tool schema
const placesSearchSchema = z.object({
  query: z.string().describe('The search query'),
  location: z.object({
    lat: z.number().describe('Latitude'),
    lng: z.number().describe('Longitude'),
  }).optional().describe('Optional location to bias the search'),
  radius: z.number().optional().describe('Optional radius in meters'),
});

// Handle MCP requests
app.post('/mcp', async (req: Request, res: Response) => {
  const { method, params, id } = req.body;

  try {
    // Get or create session
    const sessionId = req.headers['mcp-session-id'] as string || randomUUID();
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        initialized: false,
      };
    }

    // Handle initialization
    if (method === 'initialize') {
      sessions[sessionId].initialized = true;
      return res.json({
        jsonrpc: '2.0',
        result: {
          server: {
            name: 'google-maps-mcp',
            version: '1.0.0',
          },
          session: {
            id: sessionId,
          },
          tools: [
            {
              name: 'geocode',
              description: 'Convert an address to coordinates',
              parameters: geocodeSchema,
            },
            {
              name: 'places-search',
              description: 'Search for places using Google Places API',
              parameters: placesSearchSchema,
            },
          ],
        },
        id,
      });
    }

    // Handle tool calls
    if (method === 'callTool') {
      const { name, parameters } = params;

      switch (name) {
        case 'geocode': {
          const { address } = geocodeSchema.parse(parameters);
          const response = await client.geocode({
            params: {
              address,
              key: process.env.GOOGLE_MAPS_API_KEY!,
            },
          });

          const result = response.data.results[0];
          if (!result) {
            throw new Error('No results found');
          }

          return res.json({
            jsonrpc: '2.0',
            result: {
              content: [
                {
                  type: 'text',
                  text: `Found location: ${result.formatted_address}`,
                },
                {
                  type: 'json',
                  data: {
                    location: result.geometry.location,
                    formatted_address: result.formatted_address,
                    place_id: result.place_id,
                  },
                },
              ],
            },
            id,
          });
        }

        case 'places-search': {
          const { query, location, radius } = placesSearchSchema.parse(parameters);
          const response = await client.placesNearby({
            params: {
              location: location || { lat: 0, lng: 0 },
              radius: radius || 5000,
              keyword: query,
              key: process.env.GOOGLE_MAPS_API_KEY!,
            },
          });

          return res.json({
            jsonrpc: '2.0',
            result: {
              content: [
                {
                  type: 'text',
                  text: `Found ${response.data.results.length} places`,
                },
                {
                  type: 'json',
                  data: response.data.results.map(place => ({
                    name: place.name,
                    location: place.geometry?.location,
                    place_id: place.place_id,
                    types: place.types,
                    vicinity: place.vicinity,
                  })),
                },
              ],
            },
            id,
          });
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    }

    // Handle session termination
    if (method === 'terminate') {
      delete sessions[sessionId];
      return res.json({
        jsonrpc: '2.0',
        result: null,
        id,
      });
    }

    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      id,
    });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Google Maps MCP server listening on port ${PORT}`);
  console.log(`
==============================================
GOOGLE MAPS MCP SERVER

Available tools:
1. geocode
   - Convert addresses to coordinates
   - Parameters: address (string)

2. places-search
   - Search for places using Google Places API
   - Parameters: 
     - query (string)
     - location (optional): { lat: number, lng: number }
     - radius (optional): number (meters)
==============================================
`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
}); 