# Integrating mcp-genui with Cursor

This guide provides step-by-step instructions for integrating the mcp-genui Figma server with Cursor to enable AI-powered design-to-code workflows.

## Prerequisites

1. Cursor installed on your machine
2. Node.js 16 or higher
3. A Figma account and API key
4. The mcp-genui server (this repository)

## Setup Steps

### 1. Configure the MCP Server

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/mcp-genui.git
   cd mcp-genui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Figma API key:
   ```
   FIGMA_API_KEY=your_figma_api_key
   ```
   
   You can get a Figma API key from your Figma account settings under "Personal access tokens".

4. Build the server:
   ```bash
   npm run build
   ```

5. Note the absolute path to the built server executable:
   ```bash
   echo "$(pwd)/build/index.js"
   ```
   
   Save this path for the next step.

### 2. Configure Cursor

Cursor uses the Model Context Protocol (MCP) to communicate with external tools like our Figma server. To configure Cursor to use our server:

1. Open Cursor

2. Access the MCP configuration:
   - On macOS: Navigate to Cursor > Settings > Extensions > MCP Servers
   - On Windows/Linux: Navigate to File > Settings > Extensions > MCP Servers

3. Add a new MCP server with the following details:
   - Name: `mcp-genui`
   - Command: The absolute path to the server executable you saved earlier
   - Arguments: (leave empty)

4. Save the configuration and restart Cursor

### 3. Using the Figma Integration in Cursor

Once configured, you can use the Figma integration in your AI conversations within Cursor:

1. Open a project in Cursor

2. Start a conversation with Claude or another AI assistant

3. Ask questions about your Figma designs, such as:
   - "Can you describe the components in my Figma design?"
   - "Generate a React component for the navigation bar in my design"
   - "Extract the color tokens from my design system"
   - "Suggest improvements for the login form in my design"

4. The AI will use the MCP server to access your Figma designs and provide informed responses

### Example Workflow: Generating a React Component from Figma

1. In Cursor, start a conversation with Claude

2. Ask: "Generate a React component for the navigation bar in my Figma design"

3. Claude will use the MCP server to:
   - List available Figma files and components
   - Access the navigation bar component
   - Generate React code based on the design

4. Review the generated code and make any necessary adjustments

5. Integrate the component into your project

## Troubleshooting

### Server Not Found

If Cursor cannot find the MCP server:
- Verify the path in the Cursor configuration is correct
- Ensure the server file has executable permissions (`chmod +x build/index.js`)
- Try using an absolute path instead of a relative path

### Authentication Issues

If you see authentication errors:
- Check that your Figma API key is correct in the `.env` file
- Verify that your Figma account has access to the files you're trying to access
- Regenerate your API key if necessary

### No Figma Files Found

If no Figma files are listed:
- Ensure your Figma account has files in it
- Check that your API key has the correct permissions
- Look at the server logs for any API errors

## Advanced Configuration

For advanced users, you can modify the server code to:
- Add support for additional Figma features
- Implement more sophisticated code generation
- Add support for other design tools
- Customize the prompts for specific design workflows

Refer to the source code in `src/index.ts` for details on how to extend the server functionality. 