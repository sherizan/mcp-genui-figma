#!/usr/bin/env /Users/sherizan/.nvm/versions/node/v23.8.0/bin/node

/**
 * MCP server that integrates with Figma to provide access to design files.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing Figma files as resources
 * - Reading individual Figma frames/components
 * - Getting design tokens and styles
 * - Generating UI code from designs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Setup debug logging
const DEBUG = true;
const LOG_FILE = path.join(process.cwd(), 'mcp-debug.log');

function debugLog(message: string) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
  }
}

// Log startup information
debugLog('MCP server starting up');
debugLog(`Current directory: ${process.cwd()}`);
debugLog(`Node version: ${process.version}`);

// Load environment variables
dotenv.config();
debugLog('Environment variables loaded');

// Figma API configuration
const FIGMA_API_KEY = process.env.FIGMA_API_KEY;
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_DEFAULT_FILE = process.env.FIGMA_DEFAULT_FILE || '';

debugLog(`FIGMA_API_KEY present: ${!!FIGMA_API_KEY}`);
debugLog(`FIGMA_DEFAULT_FILE: ${FIGMA_DEFAULT_FILE || 'not set'}`);

if (!FIGMA_API_KEY) {
  console.error('FIGMA_API_KEY is required in .env file');
  debugLog('ERROR: FIGMA_API_KEY is required in .env file');
  process.exit(1);
}

// Configure axios for Figma API
const figmaApi = axios.create({
  baseURL: FIGMA_API_BASE,
  headers: {
    'X-Figma-Token': FIGMA_API_KEY
  }
});
debugLog('Figma API client configured');

/**
 * Type definitions for Figma data
 */
type FigmaFile = {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
};

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  description?: string;
};

type Component = {
  id: string;
  name: string;
  type: string;
  description: string;
};

/**
 * Cache for Figma data to reduce API calls
 */
const cache = {
  files: [] as FigmaFile[],
  fileNodes: {} as Record<string, FigmaNode[]>,
  nodeDetails: {} as Record<string, any>
};

/**
 * Server state to track active file
 */
const state = {
  activeFileKey: FIGMA_DEFAULT_FILE
};

/**
 * Create an MCP server with capabilities for resources (to list/read Figma designs),
 * tools (to generate code from designs), and prompts (to describe designs).
 */
const server = new Server(
  {
    name: "mcp-genui",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Fetch Figma files from the API
 */
async function fetchFigmaFiles(): Promise<FigmaFile[]> {
  if (cache.files.length > 0) {
    return cache.files;
  }

  try {
    // Try to get files from /me/files endpoint
    debugLog('Fetching files from /me/files endpoint');
    const response = await figmaApi.get('/me/files');
    cache.files = response.data.files;
    debugLog(`Found ${cache.files.length} files from /me/files endpoint`);
    return cache.files;
  } catch (error) {
    debugLog(`Error fetching files from /me/files: ${error instanceof Error ? error.message : String(error)}`);
    
    // If we have a default file key, try to use that directly
    if (FIGMA_DEFAULT_FILE || state.activeFileKey) {
      const fileKey = state.activeFileKey || FIGMA_DEFAULT_FILE;
      debugLog(`Trying to access file directly with key: ${fileKey}`);
      
      try {
        const response = await figmaApi.get(`/files/${fileKey}`);
        const file: FigmaFile = {
          key: fileKey,
          name: response.data.name,
          lastModified: new Date().toISOString()
        };
        
        cache.files = [file];
        debugLog(`Successfully accessed file: ${file.name}`);
        return cache.files;
      } catch (fileError) {
        debugLog(`Error accessing file directly: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      }
    }
    
    console.error('Error fetching Figma files:', error);
    return [];
  }
}

/**
 * Get the active Figma file
 */
async function getActiveFile(): Promise<FigmaFile | null> {
  const files = await fetchFigmaFiles();
  
  if (files.length === 0) {
    return null;
  }
  
  if (state.activeFileKey) {
    const activeFile = files.find(file => file.key === state.activeFileKey);
    if (activeFile) {
      return activeFile;
    }
  }
  
  // If no active file is set or the active file is not found, use the first file
  return files[0];
}

/**
 * Fetch nodes from a specific Figma file
 */
async function fetchFileNodes(fileKey: string, maxNodes: number = 50, maxDepth: number = 3): Promise<FigmaNode[]> {
  if (cache.fileNodes[fileKey]) {
    debugLog(`Using cached nodes for file ${fileKey}`);
    return cache.fileNodes[fileKey];
  }

  try {
    debugLog(`Fetching file data from Figma API: ${fileKey}`);
    const response = await figmaApi.get(`/files/${fileKey}`);
    const document = response.data.document;
    debugLog(`Successfully fetched file data`);
    
    // Extract frames and components
    const nodes: FigmaNode[] = [];
    
    function traverseNodes(node: any, depth: number = 0) {
      // Stop if we've reached the maximum number of nodes or max depth
      if (nodes.length >= maxNodes || depth >= maxDepth) {
        return;
      }
      
      // Only include FRAME, COMPONENT, and COMPONENT_SET types
      if (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(node.type)) {
        nodes.push({
          id: node.id,
          name: node.name,
          type: node.type,
          description: node.description || `A ${node.type.toLowerCase()} from Figma`
        });
        
        // If we've reached the max nodes, stop traversing
        if (nodes.length >= maxNodes) {
          return;
        }
      }
      
      // Recursively traverse children
      if (node.children && depth < maxDepth) {
        // Sort children to prioritize components and frames
        const sortedChildren = [...node.children].sort((a, b) => {
          const aIsImportant = ['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(a.type) ? 1 : 0;
          const bIsImportant = ['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(b.type) ? 1 : 0;
          return bIsImportant - aIsImportant;
        });
        
        for (const child of sortedChildren) {
          traverseNodes(child, depth + 1);
          if (nodes.length >= maxNodes) {
            break;
          }
        }
      }
    }
    
    debugLog(`Starting to traverse document nodes (max: ${maxNodes}, depth: ${maxDepth})`);
    traverseNodes(document);
    debugLog(`Found ${nodes.length} nodes of types FRAME, COMPONENT, or COMPONENT_SET`);
    
    cache.fileNodes[fileKey] = nodes;
    return nodes;
  } catch (error) {
    debugLog(`Error fetching nodes for file ${fileKey}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Error fetching nodes for file ${fileKey}:`, error);
    return [];
  }
}

/**
 * Fetch top-level components from a Figma file
 * This is a faster alternative to fetchFileNodes that only looks at the top level
 */
async function fetchTopLevelComponents(fileKey: string, limit: number = 10): Promise<Component[]> {
  try {
    debugLog(`Fetching top-level components from file: ${fileKey}`);
    
    // Get the file document
    const response = await figmaApi.get(`/files/${fileKey}`);
    const document = response.data.document;
    
    // Find components at the top level (canvas/pages)
    const components: Component[] = [];
    
    // Process each page/canvas
    if (document.children && Array.isArray(document.children)) {
      for (const page of document.children) {
        debugLog(`Processing page: ${page.name}`);
        
        // First check if the page itself is a component-like element
        if (isComponentLike(page)) {
          components.push({
            id: page.id,
            name: page.name,
            type: page.type,
            description: page.description || ""
          });
        }
        
        // Then process children
        if (page.children && Array.isArray(page.children)) {
          // Look for components directly on the page
          for (const node of page.children) {
            if (isComponentLike(node)) {
              components.push({
                id: node.id,
                name: node.name,
                type: node.type,
                description: node.description || ""
              });
              
              // Also check for component sets that might contain nested components
              if (node.type === "COMPONENT_SET" && node.children && Array.isArray(node.children)) {
                for (const childNode of node.children) {
                  if (isComponentLike(childNode)) {
                    components.push({
                      id: childNode.id,
                      name: childNode.name,
                      type: childNode.type,
                      description: childNode.description || ""
                    });
                  }
                }
              }
              
              // Break early if we've reached the limit
              if (components.length >= limit) {
                break;
              }
            }
          }
        }
        
        // Break early if we've reached the limit
        if (components.length >= limit) {
          break;
        }
      }
    }
    
    debugLog(`Found ${components.length} top-level components`);
    return components;
  } catch (error) {
    debugLog(`Error fetching top-level components: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to fetch components from file ${fileKey}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to check if a node is a component-like element
 */
function isComponentLike(node: any): boolean {
  return node && (
    node.type === "COMPONENT" || 
    node.type === "COMPONENT_SET" || 
    node.type === "FRAME" || 
    node.type === "INSTANCE"
  );
}

/**
 * Fetch details for a specific node
 */
async function fetchNodeDetails(fileKey: string, nodeId: string): Promise<any> {
  const cacheKey = `${fileKey}:${nodeId}`;
  if (cache.nodeDetails[cacheKey]) {
    return cache.nodeDetails[cacheKey];
  }

  try {
    const response = await figmaApi.get(`/files/${fileKey}/nodes?ids=${nodeId}`);
    const nodeData = response.data.nodes[nodeId];
    cache.nodeDetails[cacheKey] = nodeData;
    return nodeData;
  } catch (error) {
    console.error(`Error fetching details for node ${nodeId}:`, error);
    return null;
  }
}

/**
 * Log progress for long-running operations
 * This helps with debugging and understanding what's happening during component retrieval
 */
function logProgress(message: string): void {
  debugLog(`PROGRESS: ${message}`);
  // In a future version with streaming support, we could send partial responses here
}

/**
 * Handler for listing available Figma designs as resources.
 * Each design is exposed as a resource with:
 * - A figma:// URI scheme
 * - JSON MIME type
 * - Human readable name and description
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const files = await fetchFigmaFiles();
  const activeFile = await getActiveFile();
  
  const resources = [];
  
  // Add each file as a resource
  for (const file of files) {
    // Mark the active file
    const isActive = activeFile && file.key === activeFile.key;
    
    resources.push({
      uri: `figma://file/${file.key}`,
      mimeType: "application/json",
      name: `${isActive ? '✓ ' : ''}${file.name}`,
      description: `Figma file: ${file.name}${isActive ? ' (Active)' : ''}`
    });
    
    // Only fetch nodes for the active file to improve performance
    if (isActive) {
      // Fetch and add nodes from the active file
      const nodes = await fetchFileNodes(file.key);
      for (const node of nodes) {
        resources.push({
          uri: `figma://node/${file.key}/${node.id}`,
          mimeType: "application/json",
          name: `${file.name} - ${node.name}`,
          description: node.description || `A ${node.type.toLowerCase()} from ${file.name}`
        });
      }
    }
  }

  return { resources };
});

/**
 * Handler for reading the contents of a specific Figma resource.
 * Takes a figma:// URI and returns the design data as JSON.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const pathParts = url.pathname.replace(/^\//, '').split('/');
  
  if (pathParts[0] === 'file') {
    const fileKey = pathParts[1];
    const nodes = await fetchFileNodes(fileKey);
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify({ fileKey, nodes }, null, 2)
      }]
    };
  } else if (pathParts[0] === 'node') {
    const fileKey = pathParts[1];
    const nodeId = pathParts[2];
    const nodeDetails = await fetchNodeDetails(fileKey, nodeId);
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(nodeDetails, null, 2)
      }]
    };
  }

  throw new Error(`Invalid URI format: ${request.params.uri}`);
});

/**
 * Handler that lists available tools.
 * Exposes tools for generating code from Figma designs.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "set_active_figma_file",
        description: "Set the active Figma file to work with",
        inputSchema: {
          type: "object",
          properties: {
            fileKey: {
              type: "string",
              description: "Key of the Figma file to set as active"
            }
          },
          required: ["fileKey"]
        }
      },
      {
        name: "find_component_by_name",
        description: "Find a component by name in the active Figma file",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the component to find (case-insensitive, partial matches supported)"
            },
            fileKey: {
              type: "string",
              description: "Optional: Key of the Figma file to search in (defaults to active file)"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "generate_component",
        description: "Generate code for a component from a Figma design",
        inputSchema: {
          type: "object",
          properties: {
            nodeUri: {
              type: "string",
              description: "URI of the Figma node to generate code for (figma://node/{fileKey}/{nodeId})"
            },
            componentName: {
              type: "string",
              description: "Optional: Name to use for the component (defaults to node name)"
            },
            format: {
              type: "string",
              description: "Format of the generated code",
              enum: ["react", "swift", "web-component", "vue", "angular", "svelte"]
            }
          },
          required: ["nodeUri"]
        }
      },
      {
        name: "export_component_image",
        description: "Export an image of a component from Figma",
        inputSchema: {
          type: "object",
          properties: {
            nodeUri: {
              type: "string",
              description: "URI of the Figma node to export (figma://node/{fileKey}/{nodeId})"
            },
            format: {
              type: "string",
              description: "Image format to export",
              enum: ["png", "jpg", "svg", "pdf"],
              default: "png"
            },
            scale: {
              type: "number",
              description: "Scale factor for the exported image (1-4)",
              default: 1
            }
          },
          required: ["nodeUri"]
        }
      },
      {
        name: "extract_design_tokens",
        description: "Extract design tokens (colors, typography, spacing) from a Figma file",
        inputSchema: {
          type: "object",
          properties: {
            fileUri: {
              type: "string",
              description: "URI of the Figma file to extract tokens from (defaults to active file if not provided)"
            },
            format: {
              type: "string",
              description: "Format of the output tokens",
              enum: ["json", "css", "scss", "swift"]
            }
          }
        }
      }
    ]
  };
});

/**
 * Find nodes by name in a Figma file
 * This function searches deeply through the file to find nodes with matching names
 */
async function findNodesByName(fileKey: string, name: string, maxResults: number = 10): Promise<FigmaNode[]> {
  try {
    debugLog(`Searching for nodes with name containing "${name}" in file ${fileKey}`);
    
    // Get the file document
    const response = await figmaApi.get(`/files/${fileKey}`);
    const document = response.data.document;
    
    // Find nodes with matching names
    const matchingNodes: FigmaNode[] = [];
    const namePattern = new RegExp(name, 'i'); // Case-insensitive search
    
    // Recursive function to search through the document
    function searchNodes(node: any, depth: number = 0, maxDepth: number = 10) {
      if (!node || depth > maxDepth || matchingNodes.length >= maxResults) {
        return;
      }
      
      // Check if this node's name matches
      if (node.name && namePattern.test(node.name)) {
        debugLog(`Found matching node: ${node.name} (${node.type}) with ID ${node.id}`);
        matchingNodes.push({
          id: node.id,
          name: node.name,
          type: node.type || "Unknown",
          description: node.description || `A ${node.type ? node.type.toLowerCase() : 'node'} from Figma`
        });
        
        if (matchingNodes.length >= maxResults) {
          return;
        }
      }
      
      // Search children
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          searchNodes(child, depth + 1, maxDepth);
          if (matchingNodes.length >= maxResults) {
            break;
          }
        }
      }
    }
    
    // Start searching from the document root
    searchNodes(document, 0, 10);
    
    debugLog(`Found ${matchingNodes.length} nodes matching "${name}"`);
    return matchingNodes;
  } catch (error) {
    debugLog(`Error searching for nodes by name: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to search for nodes by name: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handler for tools that generate code or extract design tokens.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "set_active_figma_file": {
      const fileKey = String(request.params.arguments?.fileKey);
      
      if (!fileKey) {
        throw new Error("File key is required");
      }
      
      debugLog(`Setting active file to: ${fileKey}`);
      logProgress(`Setting active Figma file to: ${fileKey}`);
      
      try {
        // Try to verify the file exists by accessing it directly
        logProgress(`Verifying file exists and is accessible`);
        const response = await figmaApi.get(`/files/${fileKey}`);
        const fileName = response.data.name;
        
        // Set the active file
        state.activeFileKey = fileKey;
        
        // Update the cache if needed
        const existingFile = cache.files.find(f => f.key === fileKey);
        if (!existingFile) {
          cache.files.push({
            key: fileKey,
            name: fileName,
            lastModified: new Date().toISOString()
          });
        }
        
        debugLog(`Successfully set active file to: ${fileName} (${fileKey})`);
        
        return {
          content: [{
            type: "text",
            text: `✅ Active Figma file set to: "${fileName}" (${fileKey})`
          }]
        };
      } catch (error) {
        debugLog(`Error setting active file: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`File with key ${fileKey} not found or not accessible`);
      }
    }
    
    case "find_component_by_name": {
      const name = String(request.params.arguments?.name);
      const fileKey = request.params.arguments?.fileKey ? String(request.params.arguments.fileKey) : null;
      
      if (!name) {
        throw new Error("Component name is required");
      }
      
      debugLog(`Finding component with name "${name}"`);
      
      try {
        // Determine which file to use
        let targetFileKey: string;
        let fileName: string;
        
        if (fileKey) {
          // Use the specified file key
          debugLog(`Using specified file key: ${fileKey}`);
          try {
            const response = await figmaApi.get(`/files/${fileKey}`);
            targetFileKey = fileKey;
            fileName = response.data.name;
            debugLog(`Successfully accessed file: ${fileName}`);
          } catch (error) {
            const errorMsg = `File with key ${fileKey} not found or not accessible`;
            debugLog(`Error: ${errorMsg}`);
            return {
              content: [{
                type: "text",
                text: `❌ Error: ${errorMsg}\n\nPlease check your Figma API key and file access permissions.`
              }]
            };
          }
        } else {
          // Use the active file
          debugLog(`No fileKey provided, using active file`);
          const activeFile = await getActiveFile();
          if (!activeFile) {
            const errorMsg = "No active Figma file. Please set an active file first using set_active_figma_file.";
            debugLog(`Error: ${errorMsg}`);
            return {
              content: [{
                type: "text",
                text: `❌ Error: ${errorMsg}`
              }]
            };
          }
          targetFileKey = activeFile.key;
          fileName = activeFile.name;
          debugLog(`Using active file: ${fileName} (${targetFileKey})`);
        }
        
        // Search for nodes with matching names
        const matchingNodes = await findNodesByName(targetFileKey, name, 10);
        
        if (matchingNodes.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No components found with name containing "${name}" in file "${fileName}".\n\nTry a different name or check if the component exists in this file.`
            }]
          };
        }
        
        // Format the output
        let output = `# Components matching "${name}" in "${fileName}"\n\n`;
        output += `Found ${matchingNodes.length} matching components:\n\n`;
        output += `| Name | Type | Node ID | URI |\n`;
        output += `|------|------|---------|-----|\n`;
        
        for (const node of matchingNodes) {
          output += `| ${node.name} | ${node.type} | ${node.id} | \`figma://node/${targetFileKey}/${node.id}\` |\n`;
        }
        
        output += `\n`;
        output += `## How to use these components\n\n`;
        output += `To export an image of a component, use:\n`;
        output += `\`\`\`json\n`;
        output += `{\n`;
        output += `  "nodeUri": "figma://node/${targetFileKey}/${matchingNodes[0].id}",\n`;
        output += `  "format": "png",\n`;
        output += `  "scale": 2\n`;
        output += `}\n`;
        output += `\`\`\`\n\n`;
        
        output += `To generate code for a component, use:\n`;
        output += `\`\`\`json\n`;
        output += `{\n`;
        output += `  "nodeUri": "figma://node/${targetFileKey}/${matchingNodes[0].id}",\n`;
        output += `  "format": "react"\n`;
        output += `}\n`;
        output += `\`\`\`\n`;
        
        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog(`Error in find_component_by_name: ${errorMessage}`);
        
        return {
          content: [{
            type: "text",
            text: `❌ Error finding component: ${errorMessage}\n\nPlease check your Figma API key and file access permissions.`
          }]
        };
      }
    }
    
    case "generate_component": {
      const nodeUri = String(request.params.arguments?.nodeUri);
      const format = String(request.params.arguments?.format || "react");
      const customComponentName = request.params.arguments?.componentName 
        ? String(request.params.arguments.componentName) 
        : null;
      
      if (!nodeUri) {
        throw new Error("Node URI is required");
      }
      
      debugLog(`Starting code generation for ${nodeUri} in ${format} format`);
      
      // Parse the URI to get file key and node ID
      let fileKey: string;
      let nodeId: string;
      
      try {
        debugLog(`Parsing node URI: ${nodeUri}`);
        
        // Handle different URI formats
        if (nodeUri.startsWith('figma://')) {
          // Full URI format: figma://node/{fileKey}/{nodeId}
          try {
            // Use a more flexible approach to parse the URI
            const figmaPattern = /^figma:\/\/node\/([^\/]+)\/(.+)$/;
            const matches = nodeUri.match(figmaPattern);
            
            debugLog(`Regex matching result: ${JSON.stringify(matches)}`);
            
            if (!matches || matches.length < 3) {
              throw new Error(`Invalid node URI format: ${nodeUri}. Expected format: figma://node/{fileKey}/{nodeId}`);
            }
            
            fileKey = matches[1];
            nodeId = matches[2];
            
            debugLog(`Parsed using regex: fileKey=${fileKey}, nodeId=${nodeId}`);
          } catch (urlError) {
            debugLog(`Error parsing URL: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
            throw new Error(`Invalid node URI format: ${nodeUri}. Expected format: figma://node/{fileKey}/{nodeId}`);
          }
        } else if (nodeUri.includes('/')) {
          // Try to parse as fileKey/nodeId format
          const parts = nodeUri.split('/', 2); // Limit to 2 parts to handle nodeIds that may contain slashes
          debugLog(`Split by slash: ${JSON.stringify(parts)}`);
          
          if (parts.length === 2) {
            fileKey = parts[0];
            nodeId = parts[1];
          } else {
            throw new Error(`Invalid node URI format: ${nodeUri}. Expected format: {fileKey}/{nodeId}`);
          }
        } else {
          // Just the node ID, use active file
          debugLog(`Treating as node ID only: ${nodeUri}`);
          const activeFile = await getActiveFile();
          if (!activeFile) {
            throw new Error("No active Figma file. Please set an active file first using set_active_figma_file.");
          }
          
          fileKey = activeFile.key;
          nodeId = nodeUri;
        }
        
        if (!fileKey || !nodeId) {
          throw new Error(`Could not extract fileKey and nodeId from URI: ${nodeUri}`);
        }
        
        debugLog(`Successfully parsed URI: fileKey=${fileKey}, nodeId=${nodeId}`);
        logProgress(`Parsed URI: fileKey=${fileKey}, nodeId=${nodeId}`);
        
        // Fetch node details
        logProgress(`Fetching details for node ${nodeId} from Figma API`);
        const nodeDetails = await fetchNodeDetails(fileKey, nodeId);
        if (!nodeDetails || !nodeDetails.document) {
          throw new Error(`Node ${nodeId} not found in file ${fileKey}`);
        }
        
        // Get the component name
        const nodeName = nodeDetails.document.name;
        const componentName = customComponentName || nodeName.replace(/[^a-zA-Z0-9]/g, '');
        logProgress(`Generating ${format} code for component "${nodeName}" (${componentName})`);
        
        // Generate code based on the format
        let generatedCode = "";
        let language = "";
        
        switch (format) {
          case "react":
            language = "jsx";
            generatedCode = generateReactComponent(componentName, nodeName, nodeDetails);
            break;
            
          case "swift":
            language = "swift";
            generatedCode = generateSwiftComponent(componentName, nodeName, nodeDetails);
            break;
            
          case "web-component":
            language = "javascript";
            generatedCode = generateWebComponent(componentName, nodeName, nodeDetails);
            break;
            
          case "vue":
            language = "vue";
            generatedCode = generateVueComponent(componentName, nodeName, nodeDetails);
            break;
            
          case "angular":
            language = "typescript";
            generatedCode = generateAngularComponent(componentName, nodeName, nodeDetails);
            break;
            
          case "svelte":
            language = "svelte";
            generatedCode = generateSvelteComponent(componentName, nodeName, nodeDetails);
            break;
            
          default:
            language = "jsx";
            generatedCode = generateReactComponent(componentName, nodeName, nodeDetails);
        }
        
        logProgress(`Code generation complete for ${componentName}`);
        
        return {
          content: [{
            type: "text",
            text: `✅ Generated ${format.toUpperCase()} component "${componentName}" from Figma node "${nodeName}"\n\n\`\`\`${language}\n${generatedCode}\n\`\`\``
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog(`Error in generate_component: ${errorMessage}`);
        
        // Provide a helpful error message with examples
        return {
          content: [{
            type: "text",
            text: `❌ Error: ${errorMessage}\n\nValid URI formats:\n1. figma://node/{fileKey}/{nodeId}\n2. {fileKey}/{nodeId}\n3. {nodeId} (uses active file)\n\nExample: figma://node/KqD1Flt6R0C7aC35bBp7gG/1:2\nExample: KqD1Flt6R0C7aC35bBp7gG/1:2\nExample: 1:2 (with active file set)`
          }]
        };
      }
    }
    
    case "export_component_image": {
      const nodeUri = String(request.params.arguments?.nodeUri);
      const format = String(request.params.arguments?.format || "png");
      const scale = Number(request.params.arguments?.scale || 1);
      
      if (!nodeUri) {
        throw new Error("Node URI is required");
      }
      
      debugLog(`Starting image export for ${nodeUri} in ${format} format at scale ${scale}x`);
      
      // Parse the URI to get file key and node ID
      let fileKey: string;
      let nodeId: string;
      
      try {
        debugLog(`Parsing node URI: ${nodeUri}`);
        
        // Handle different URI formats
        if (nodeUri.startsWith('figma://')) {
          // Full URI format: figma://node/{fileKey}/{nodeId}
          try {
            // Use a more flexible approach to parse the URI
            const figmaPattern = /^figma:\/\/node\/([^\/]+)\/(.+)$/;
            const matches = nodeUri.match(figmaPattern);
            
            debugLog(`Regex matching result: ${JSON.stringify(matches)}`);
            
            if (!matches || matches.length < 3) {
              throw new Error(`Invalid node URI format: ${nodeUri}. Expected format: figma://node/{fileKey}/{nodeId}`);
            }
            
            fileKey = matches[1];
            nodeId = matches[2];
            
            debugLog(`Parsed using regex: fileKey=${fileKey}, nodeId=${nodeId}`);
          } catch (urlError) {
            debugLog(`Error parsing URL: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
            throw new Error(`Invalid node URI format: ${nodeUri}. Expected format: figma://node/{fileKey}/{nodeId}`);
          }
        } else if (nodeUri.includes('/')) {
          // Try to parse as fileKey/nodeId format
          const parts = nodeUri.split('/', 2); // Limit to 2 parts to handle nodeIds that may contain slashes
          debugLog(`Split by slash: ${JSON.stringify(parts)}`);
          
          if (parts.length === 2) {
            fileKey = parts[0];
            nodeId = parts[1];
          } else {
            throw new Error(`Invalid node URI format: ${nodeUri}. Expected format: {fileKey}/{nodeId}`);
          }
        } else {
          // Just the node ID, use active file
          debugLog(`Treating as node ID only: ${nodeUri}`);
          const activeFile = await getActiveFile();
          if (!activeFile) {
            throw new Error("No active Figma file. Please set an active file first using set_active_figma_file.");
          }
          
          fileKey = activeFile.key;
          nodeId = nodeUri;
        }
        
        if (!fileKey || !nodeId) {
          throw new Error(`Could not extract fileKey and nodeId from URI: ${nodeUri}`);
        }
        
        debugLog(`Successfully parsed URI: fileKey=${fileKey}, nodeId=${nodeId}`);
        logProgress(`Parsed URI: fileKey=${fileKey}, nodeId=${nodeId}`);
        
        // Verify the node exists before trying to export
        try {
          debugLog(`Verifying node exists: ${nodeId}`);
          const nodeDetails = await fetchNodeDetails(fileKey, nodeId);
          
          if (!nodeDetails || !nodeDetails.document) {
            debugLog(`Node not found: ${nodeId}`);
            throw new Error(`Node ${nodeId} not found in file ${fileKey}.`);
          }
          
          debugLog(`Node verified: ${nodeDetails.document.name}`);
        } catch (nodeError) {
          debugLog(`Error verifying node: ${nodeError instanceof Error ? nodeError.message : String(nodeError)}`);
          throw new Error(`Failed to verify node ${nodeId}: ${nodeError instanceof Error ? nodeError.message : String(nodeError)}`);
        }
        
        // Get image URL from Figma API
        logProgress(`Requesting image export from Figma API`);
        try {
          const response = await figmaApi.get(
            `/images/${fileKey}?ids=${nodeId}&format=${format}&scale=${scale}`
          );
          
          if (!response.data.images || !response.data.images[nodeId]) {
            debugLog(`No image returned for node ${nodeId}`);
            throw new Error(`Failed to export image for node ${nodeId}. The node might not be exportable.`);
          }
          
          const imageUrl = response.data.images[nodeId];
          logProgress(`Image export successful, URL: ${imageUrl}`);
          
          // Get node details for the name
          const nodeDetails = await fetchNodeDetails(fileKey, nodeId);
          const nodeName = nodeDetails?.document?.name || nodeId;
          
          return {
            content: [{
              type: "text",
              text: `✅ Exported ${format.toUpperCase()} image of "${nodeName}" at ${scale}x scale\n\n![${nodeName}](${imageUrl})\n\nDirect URL: ${imageUrl}`
            }]
          };
        } catch (error) {
          debugLog(`Error exporting image: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to export image: ${error instanceof Error ? error.message : String(error)}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog(`Error in export_component_image: ${errorMessage}`);
        
        // Provide a helpful error message with examples
        return {
          content: [{
            type: "text",
            text: `❌ Error: ${errorMessage}\n\nValid URI formats:\n1. figma://node/{fileKey}/{nodeId}\n2. {fileKey}/{nodeId}\n3. {nodeId} (uses active file)\n\nExample: figma://node/KqD1Flt6R0C7aC35bBp7gG/1:2\nExample: KqD1Flt6R0C7aC35bBp7gG/1:2\nExample: 1:2 (with active file set)`
          }]
        };
      }
    }

    case "extract_design_tokens": {
      const fileUri = request.params.arguments?.fileUri ? String(request.params.arguments.fileUri) : null;
      const format = String(request.params.arguments?.format || "json");
      
      logProgress(`Starting design token extraction in ${format} format`);
      
      let fileKey: string;
      
      try {
        if (fileUri) {
          debugLog(`Parsing file URI: ${fileUri}`);
          
          // Handle different URI formats
          if (fileUri.startsWith('figma://')) {
            // Full URI format: figma://file/{fileKey}
            try {
              // Use a more flexible approach to parse the URI
              const figmaPattern = /^figma:\/\/file\/([^\/]+)$/;
              const matches = fileUri.match(figmaPattern);
              
              debugLog(`Regex matching result: ${JSON.stringify(matches)}`);
              
              if (!matches || matches.length < 2) {
                throw new Error(`Invalid file URI format: ${fileUri}. Expected format: figma://file/{fileKey}`);
              }
              
              fileKey = matches[1];
              debugLog(`Parsed using regex: fileKey=${fileKey}`);
            } catch (urlError) {
              debugLog(`Error parsing URL: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
              throw new Error(`Invalid file URI format: ${fileUri}. Expected format: figma://file/{fileKey}`);
            }
          } else {
            // Assume it's just the file key
            fileKey = fileUri;
            debugLog(`Using direct file key: ${fileKey}`);
          }
          logProgress(`Using file from URI/key: ${fileKey}`);
        } else {
          // Use the active file
          const activeFile = await getActiveFile();
          if (!activeFile) {
            throw new Error("No active Figma file. Please set an active file first using set_active_figma_file.");
          }
          fileKey = activeFile.key;
          debugLog(`Using active file key: ${fileKey}`);
          logProgress(`Using active file: ${fileKey}`);
        }
        
        // Verify the file exists
        logProgress(`Verifying file exists`);
        const files = await fetchFigmaFiles();
        const file = files.find(f => f.key === fileKey);
        
        if (!file) {
          // Try to access the file directly
          try {
            logProgress(`File not found in cache, trying to access directly`);
            const response = await figmaApi.get(`/files/${fileKey}`);
            const fileName = response.data.name;
            
            // Create a file object
            const newFile: FigmaFile = {
              key: fileKey,
              name: fileName,
              lastModified: new Date().toISOString()
            };
            
            // Add to cache
            cache.files.push(newFile);
            
            logProgress(`Extracting design tokens from "${fileName}"`);
            
            // Continue with the extracted file
            const designTokens = extractDesignTokens(format);
            
            return formatDesignTokensResponse(format, designTokens, fileName);
          } catch (error) {
            debugLog(`Error accessing file directly: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`File with key ${fileKey} not found or not accessible`);
          }
        }
        
        logProgress(`Extracting design tokens from "${file.name}"`);
        
        // Extract design tokens
        const designTokens = extractDesignTokens(format);
        
        return formatDesignTokensResponse(format, designTokens, file.name);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog(`Error extracting design tokens: ${errorMessage}`);
        
        // Provide a helpful error message with examples
        return {
          content: [{
            type: "text",
            text: `❌ Error: ${errorMessage}\n\nValid URI formats:\n1. figma://file/{fileKey}\n2. {fileKey} (direct file key)\n\nExample: figma://file/KqD1Flt6R0C7aC35bBp7gG\nExample: KqD1Flt6R0C7aC35bBp7gG`
          }]
        };
      }
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Handler that lists available prompts.
 * Exposes prompts for describing designs and suggesting improvements.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "describe_design",
        description: "Describe a Figma design in detail",
      },
      {
        name: "suggest_improvements",
        description: "Suggest improvements for a Figma design",
      }
    ]
  };
});

/**
 * Handler for prompts related to Figma designs.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  // Use the active file
  const activeFile = await getActiveFile();
  
  if (!activeFile) {
    throw new Error("No Figma files available. Please check your Figma account and API key.");
  }
  
  const nodes = await fetchFileNodes(activeFile.key);
  
  if (nodes.length === 0) {
    throw new Error(`No components or frames found in the active Figma file: ${activeFile.name}`);
  }
  
  // Prepare embedded resources for the first few nodes (limit to avoid overwhelming)
  const embeddedNodes = await Promise.all(
    nodes.slice(0, 5).map(async (node) => {
      const nodeDetails = await fetchNodeDetails(activeFile.key, node.id);
      return {
        type: "resource" as const,
        resource: {
          uri: `figma://node/${activeFile.key}/${node.id}`,
          mimeType: "application/json",
          text: JSON.stringify(nodeDetails, null, 2)
        }
      };
    })
  );
  
  switch (request.params.name) {
    case "describe_design":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please describe the following Figma design components from file "${activeFile.name}" in detail:`
            }
          },
          ...embeddedNodes.map(node => ({
            role: "user" as const,
            content: node
          })),
          {
            role: "user",
            content: {
              type: "text",
              text: "For each component, describe its visual appearance, layout, colors, typography, and purpose. Also mention any patterns or design systems you notice."
            }
          }
        ]
      };
      
    case "suggest_improvements":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please suggest improvements for the following Figma design components from file "${activeFile.name}":`
            }
          },
          ...embeddedNodes.map(node => ({
            role: "user" as const,
            content: node
          })),
          {
            role: "user",
            content: {
              type: "text",
              text: "For each component, suggest improvements for accessibility, usability, visual design, and consistency with modern design practices. Be specific and actionable in your suggestions."
            }
          }
        ]
      };
      
    default:
      throw new Error("Unknown prompt");
  }
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  try {
    debugLog('Creating StdioServerTransport');
    const transport = new StdioServerTransport();
    
    debugLog('Connecting server to transport');
    await server.connect(transport);
    
    debugLog('Server connected successfully');
  } catch (error) {
    debugLog(`ERROR in main: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Server error:", error);
    process.exit(1);
  }
}

debugLog('Calling main function');
main().catch((error) => {
  debugLog(`FATAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
  console.error("Server error:", error);
  process.exit(1);
});

/**
 * Generate a React component from a Figma node
 */
function generateReactComponent(componentName: string, nodeName: string, nodeDetails: any): string {
  return `import React from 'react';
import './styles/${componentName}.css';

export const ${componentName} = ({ children, ...props }) => {
  return (
    <div className="${componentName.toLowerCase()}" {...props}>
      {/* Generated from Figma node: ${nodeName} */}
      <h2>Component Content</h2>
      {children}
    </div>
  );
};

export default ${componentName};
`;
}

/**
 * Generate a Swift UI component from a Figma node
 */
function generateSwiftComponent(componentName: string, nodeName: string, nodeDetails: any): string {
  return `import SwiftUI

struct ${componentName}: View {
    // MARK: - Properties
    var title: String = "Component Content"
    
    // MARK: - Body
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Generated from Figma node: ${nodeName}
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .shadow(radius: 2)
    }
}

// MARK: - Preview
struct ${componentName}_Previews: PreviewProvider {
    static var previews: some View {
        ${componentName}()
    }
}
`;
}

/**
 * Generate a Web Component from a Figma node
 */
function generateWebComponent(componentName: string, nodeName: string, nodeDetails: any): string {
  // Convert component name to kebab-case for HTML custom element
  const kebabName = componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z])(?=[a-z])/g, '$1-$2')
    .toLowerCase();
  
  return `class ${componentName} extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    // Generated from Figma node: ${nodeName}
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          font-family: sans-serif;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
      </style>
      <div class="${kebabName}">
        <h2>Component Content</h2>
        <slot></slot>
      </div>
    \`;
  }
}

// Register the custom element
customElements.define('${kebabName}', ${componentName});
`;
}

/**
 * Generate a Vue component from a Figma node
 */
function generateVueComponent(componentName: string, nodeName: string, nodeDetails: any): string {
  return `<template>
  <div class="${componentName.toLowerCase()}">
    <!-- Generated from Figma node: ${nodeName} -->
    <h2>Component Content</h2>
    <slot></slot>
  </div>
</template>

<script>
export default {
  name: '${componentName}',
  props: {
    // Define props here
  },
  data() {
    return {
      // Component state
    }
  },
  methods: {
    // Component methods
  }
}
</script>

<style scoped>
.${componentName.toLowerCase()} {
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
`;
}

/**
 * Generate an Angular component from a Figma node
 */
function generateAngularComponent(componentName: string, nodeName: string, nodeDetails: any): string {
  // Convert component name to kebab-case for Angular selector
  const kebabName = componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z])(?=[a-z])/g, '$1-$2')
    .toLowerCase();
  
  return `import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-${kebabName}',
  template: \`
    <div class="${kebabName}">
      <!-- Generated from Figma node: ${nodeName} -->
      <h2>Component Content</h2>
      <ng-content></ng-content>
    </div>
  \`,
  styles: [\`
    .${kebabName} {
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  \`]
})
export class ${componentName}Component {
  // Component inputs
  @Input() title: string = 'Component Content';
  
  // Component logic
  constructor() { }
}
`;
}

/**
 * Generate a Svelte component from a Figma node
 */
function generateSvelteComponent(componentName: string, nodeName: string, nodeDetails: any): string {
  return `<script>
  // Generated from Figma node: ${nodeName}
  export let title = 'Component Content';
</script>

<div class="${componentName.toLowerCase()}">
  <h2>{title}</h2>
  <slot></slot>
</div>

<style>
  .${componentName.toLowerCase()} {
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>
`;
}

/**
 * Extract design tokens in the specified format
 */
function extractDesignTokens(format: string): any {
  // In a real implementation, you would analyze the file to extract actual design tokens
  // This is a simplified example
  return {
    colors: {
      primary: "#0066FF",
      secondary: "#FF6600",
      background: "#FFFFFF",
      text: "#333333"
    },
    typography: {
      heading: {
        fontFamily: "Inter, sans-serif",
        fontSize: "24px",
        fontWeight: "600"
      },
      body: {
        fontFamily: "Inter, sans-serif",
        fontSize: "16px",
        fontWeight: "400"
      }
    },
    spacing: {
      small: "8px",
      medium: "16px",
      large: "24px"
    }
  };
}

/**
 * Format design tokens response based on the requested format
 */
function formatDesignTokensResponse(format: string, designTokens: any, fileName: string): any {
  let output = "";
  let language = "";
  
  logProgress(`Formatting tokens as ${format}`);
  
  if (format === "json") {
    language = "json";
    output = JSON.stringify(designTokens, null, 2);
  } else if (format === "css") {
    language = "css";
    output = `:root {
  /* Colors */
  --color-primary: #0066FF;
  --color-secondary: #FF6600;
  --color-background: #FFFFFF;
  --color-text: #333333;
  
  /* Typography */
  --font-family: Inter, sans-serif;
  --font-size-heading: 24px;
  --font-weight-heading: 600;
  --font-size-body: 16px;
  --font-weight-body: 400;
  
  /* Spacing */
  --spacing-small: 8px;
  --spacing-medium: 16px;
  --spacing-large: 24px;
}`;
  } else if (format === "scss") {
    language = "scss";
    output = `// Colors
$color-primary: #0066FF;
$color-secondary: #FF6600;
$color-background: #FFFFFF;
$color-text: #333333;

// Typography
$font-family: Inter, sans-serif;
$font-size-heading: 24px;
$font-weight-heading: 600;
$font-size-body: 16px;
$font-weight-body: 400;

// Spacing
$spacing-small: 8px;
$spacing-medium: 16px;
$spacing-large: 24px;`;
  } else if (format === "swift") {
    language = "swift";
    output = `import SwiftUI

struct DesignTokens {
    // MARK: - Colors
    struct Colors {
        static let primary = Color(hex: 0x0066FF)
        static let secondary = Color(hex: 0xFF6600)
        static let background = Color(hex: 0xFFFFFF)
        static let text = Color(hex: 0x333333)
    }
    
    // MARK: - Typography
    struct Typography {
        struct Heading {
            static let fontFamily = "Inter"
            static let fontSize: CGFloat = 24
            static let fontWeight: Font.Weight = .semibold
        }
        
        struct Body {
            static let fontFamily = "Inter"
            static let fontSize: CGFloat = 16
            static let fontWeight: Font.Weight = .regular
        }
    }
    
    // MARK: - Spacing
    struct Spacing {
        static let small: CGFloat = 8
        static let medium: CGFloat = 16
        static let large: CGFloat = 24
    }
}

// Helper extension for hex colors
extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}`;
  }
  
  logProgress(`Design token extraction complete`);
  
  return {
    content: [{
      type: "text",
      text: `✅ Design tokens extracted from: "${fileName}"\n\n\`\`\`${language}\n${output}\n\`\`\``
    }]
  };
}
