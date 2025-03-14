# MCP-GenUI: Figma Design Integration Server

## Overview

MCP-GenUI is a Model Context Protocol (MCP) server that integrates with Figma to provide seamless access to design files and components. It enables AI assistants to:

1. Browse and access Figma design files
2. List components, frames, and design elements
3. Generate code in multiple formats (React, Swift, Web Components, etc.)
4. Extract design tokens and styles
5. Provide design descriptions and improvement suggestions

## Setup

### Prerequisites

- Node.js v16+
- Figma account with API access
- Figma API key

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your Figma API key:
   ```
   FIGMA_API_KEY=your_figma_api_key_here
   FIGMA_DEFAULT_FILE=optional_default_file_key
   ```
4. Build the server:
   ```
   npm run build
   ```
5. Make the run script executable:
   ```
   chmod +x run-mcp.sh
   ```

### Integration with Cursor

Add the server to your Cursor MCP configuration in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-genui": {
      "command": "/path/to/mcp-genui/run-mcp.sh"
    }
  }
}
```

## Features

### Resources

The server exposes Figma designs as resources with:
- `figma://file/{fileKey}` URIs for Figma files
- `figma://node/{fileKey}/{nodeId}` URIs for components and frames
- JSON representation of design data

### Tools

#### Set Active Figma File

```
Claude, please set the active Figma file to 0RCoKeI0gB5jpaOjdHt7aE
```

This tool sets the current working file for subsequent operations.

#### List Components

```
Claude, please list the components in my Figma file
```

Lists all components, frames, and component sets in the active Figma file, organized by type with their node IDs and URIs.

#### Generate Component

```
Claude, please generate a React component for node figma://node/0RCoKeI0gB5jpaOjdHt7aE/123:456
```

Generates code for a component in various formats:
- React
- Swift
- Web Components
- Vue
- Angular
- Svelte

You can also use a simplified format with just the node ID when working with the active file:

```
Claude, please generate a Swift component for node 123:456 named NavigationBar
```

#### Extract Design Tokens

```
Claude, please extract design tokens from my Figma file in CSS format
```

Extracts design tokens (colors, typography, spacing) in various formats:
- JSON
- CSS
- SCSS
- Swift

### Prompts

The server provides prompts for:
- Describing designs in detail
- Suggesting design improvements

## Architecture

The server is built using:
- MCP SDK for server implementation
- Figma API for accessing design data
- Node.js for runtime environment

Key components:
- Resource handlers for browsing designs
- Tool handlers for generating code
- Prompt handlers for design analysis
- Caching system to reduce API calls

## Debugging

The server includes debug logging to help troubleshoot issues:
- Logs are written to `mcp-debug.log` in the project directory
- Debug mode can be toggled in the code

## Usage Examples

### Complete Workflow

1. Set the active Figma file:
   ```
   Claude, please set the active Figma file to 0RCoKeI0gB5jpaOjdHt7aE
   ```

2. List available components:
   ```
   Claude, please list the components in my Figma file
   ```

3. Generate a component:
   ```
   Claude, please generate a React component for node 123:456
   ```

4. Extract design tokens:
   ```
   Claude, please extract design tokens in Swift format
   ```

### Advanced Usage

- Filter components by type:
  ```
  Claude, please list only COMPONENT_SET type components
  ```

- Generate a component with a custom name:
  ```
  Claude, please generate a web component for node 123:456 named NavigationBar
  ```

- Access a specific file directly:
  ```
  Claude, please list components in Figma file 0RCoKeI0gB5jpaOjdHt7aE
  ```

## Troubleshooting

### Common Issues

1. **"File with key not found"**: Ensure the file key is correct and you have access to the file.

2. **Invalid node URI**: Use the correct format `figma://node/{fileKey}/{nodeId}` or just the node ID when using the active file.

3. **No active Figma file**: Set an active file before performing operations that require one.

4. **API access issues**: Verify your Figma API key has the necessary permissions.

### Debugging Steps

1. Check the `mcp-debug.log` file for detailed error information.

2. Verify your Figma API key is correctly set in the `.env` file.

3. Ensure you have access to the Figma files you're trying to use.

4. Try setting a default file in the `.env` file with `FIGMA_DEFAULT_FILE=your_file_key`.

## Future Enhancements

- Support for more output formats
- Better visualization of design components
- Integration with design systems
- Support for collaborative design workflows
- Enhanced design token extraction
