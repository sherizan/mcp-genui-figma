# mcp-genui Setup Guide

This guide will walk you through setting up the mcp-genui Figma integration with Cursor step by step.

## Overview

The mcp-genui server allows Cursor to access your Figma designs, enabling AI-powered design-to-code workflows. With this integration, you can:

- Browse your Figma files and components
- Generate React components from Figma designs
- Extract design tokens (colors, typography, spacing)
- Get AI-powered design feedback and suggestions

## Step 1: Prerequisites

Before you begin, make sure you have:

- [Cursor](https://cursor.sh/) installed on your computer
- [Node.js](https://nodejs.org/) version 16 or higher
- A [Figma](https://figma.com/) account with some designs
- A Figma API key (Personal Access Token)

### Getting a Figma API Key

1. Log in to your Figma account
2. Go to Settings > Account > Personal Access Tokens
3. Click "Create a new personal access token"
4. Give it a name (e.g., "mcp-genui")
5. Copy the generated token (you won't be able to see it again)

### Finding Your Figma File Key

If you want to set a default Figma file, you'll need its file key:

1. Open the Figma file in your browser
2. Look at the URL, which will be in this format:
   ```
   https://www.figma.com/file/abcdef123456/MyDesign
   ```
3. The file key is the part after "file/" and before any additional parameters (in this example, "abcdef123456")

## Step 2: Install the MCP Server

1. Clone or download this repository:
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
   
   # Optional: Specify a default Figma file
   # FIGMA_DEFAULT_FILE=your_figma_file_key_here
   ```

4. Build the server:
   ```bash
   npm run build
   ```

5. Get the absolute path to the server executable:
   ```bash
   # On macOS/Linux
   echo "$(pwd)/build/index.js"
   
   # On Windows (PowerShell)
   Write-Output "$((Get-Location).Path)\build\index.js"
   ```
   
   Copy this path for the next step.

## Step 3: Configure Cursor

1. Open Cursor

2. Access the MCP configuration:
   - On macOS: Navigate to Cursor > Settings > Extensions > MCP Servers
   - On Windows/Linux: Navigate to File > Settings > Extensions > MCP Servers

3. Add a new MCP server with the following details:
   - Name: `mcp-genui`
   - Command: The absolute path to the server executable you copied earlier
   - Arguments: (leave empty)

4. Save the configuration and restart Cursor

## Step 4: Test the Integration

1. Open a project in Cursor

2. Start a conversation with Claude or another AI assistant

3. Try one of these example prompts:
   - "Set the active Figma file to XYZ123456" (replace with your actual file key)
   - "Can you describe the components in my active Figma design?"
   - "Generate a React component for the navigation bar in my design"
   - "Extract the color tokens from my design system as SCSS variables"
   - "Suggest improvements for the login form in my design"

4. The AI should respond by accessing your Figma designs through the MCP server

## Working with Multiple Figma Files

The MCP server now supports working with multiple Figma files:

1. **Setting a default file** in the `.env` file:
   ```
   FIGMA_DEFAULT_FILE=your_figma_file_key_here
   ```

2. **Switching between files** during a conversation:
   - Ask Claude to "Set the active Figma file to XYZ123456"
   - The active file will be marked with a checkmark (✓) in the file list

3. **Viewing available files**:
   - Ask Claude to "List my Figma files"
   - It will show all files with the active one marked

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

### File Key Not Found

If you get an error when setting the active file:
- Double-check the file key from the Figma URL
- Make sure you have access to that file with your account
- Try copying the key directly from the URL to avoid typos

## Next Steps

- Check out the examples in the `examples` directory for more usage scenarios
- Read the `CURSOR_INTEGRATION.md` file for more detailed information
- Explore the source code in `src/index.ts` to understand how the server works

## Support

If you encounter any issues or have questions, please:
1. Check the troubleshooting section above
2. Look for similar issues in the GitHub repository
3. Open a new issue if your problem is not addressed 