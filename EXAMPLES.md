# mcp-genui Usage Examples

This directory contains examples of how to use the mcp-genui Figma integration with Cursor in real-world scenarios.

## Example 1: Generating a React Component from a Figma Design

### Scenario
You have a Figma design for a navigation bar component and want to generate a React implementation.

### Steps

1. In Cursor, start a conversation with Claude
2. Ask: "Generate a React component for the navigation bar in my Figma design"
3. Claude will use the MCP server to:
   - List available Figma files and components
   - Access the navigation bar component
   - Generate React code based on the design

### Example Conversation

**You**: Generate a React component for the navigation bar in my Figma design

**Claude**: I'll help you generate a React component for the navigation bar in your Figma design. Let me check your available Figma files and components.

I found the following navigation bar component in your Figma design: "Website - Navigation Bar"

Based on this design, here's a React component implementation:

```jsx
import React, { useState } from 'react';
import './NavigationBar.css';

export const NavigationBar = ({ logo, menuItems }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  return (
    <nav className="navigation-bar">
      <div className="nav-container">
        <div className="logo">
          {logo || <img src="/logo.svg" alt="Company Logo" />}
        </div>
        
        <div className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        
        <ul className={`menu-items ${isMenuOpen ? 'open' : ''}`}>
          {menuItems?.map((item, index) => (
            <li key={index}>
              <a href={item.url}>{item.label}</a>
            </li>
          )) || (
            <>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/services">Services</a></li>
              <li><a href="/contact">Contact</a></li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default NavigationBar;
```

And here's the accompanying CSS:

```css
.navigation-bar {
  width: 100%;
  height: 70px;
  background-color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.logo {
  height: 40px;
}

.logo img {
  height: 100%;
}

.menu-items {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}

.menu-items li {
  margin-left: 30px;
}

.menu-items li a {
  text-decoration: none;
  color: #333;
  font-weight: 500;
  font-size: 16px;
  transition: color 0.3s ease;
}

.menu-items li a:hover {
  color: #0066ff;
}

.menu-toggle {
  display: none;
}

@media (max-width: 768px) {
  .menu-toggle {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 30px;
    height: 21px;
    cursor: pointer;
  }
  
  .menu-toggle span {
    width: 100%;
    height: 3px;
    background-color: #333;
    transition: all 0.3s ease;
  }
  
  .menu-items {
    position: absolute;
    top: 70px;
    left: 0;
    width: 100%;
    background-color: #ffffff;
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-100%);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }
  
  .menu-items.open {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
  }
  
  .menu-items li {
    margin: 15px 0;
  }
}
```

This component is responsive and includes:
- A logo section
- Navigation links
- Mobile menu toggle
- Responsive design with a hamburger menu on smaller screens

You can use it like this:

```jsx
import NavigationBar from './NavigationBar';

function App() {
  const menuItems = [
    { label: 'Home', url: '/' },
    { label: 'About', url: '/about' },
    { label: 'Services', url: '/services' },
    { label: 'Contact', url: '/contact' }
  ];

  return (
    <div className="app">
      <NavigationBar menuItems={menuItems} />
      {/* Rest of your app */}
    </div>
  );
}
```

## Example 2: Extracting Design Tokens

### Scenario
You want to extract design tokens (colors, typography, spacing) from your Figma design system.

### Steps

1. In Cursor, start a conversation with Claude
2. Ask: "Extract design tokens from my Figma design system"
3. Claude will use the MCP server to:
   - Access your Figma design system file
   - Extract design tokens
   - Format them as requested (JSON, CSS, or SCSS)

### Example Conversation

**You**: Extract design tokens from my Figma design system as SCSS variables

**Claude**: I'll extract the design tokens from your Figma design system and format them as SCSS variables. Let me check your Figma files.

I found your design system file: "Design System - Components"

Here are the extracted design tokens as SCSS variables:

```scss
// Colors
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
$spacing-large: 24px;
```

You can use these variables in your SCSS files by importing this file:

```scss
@import 'design-tokens';

.button {
  background-color: $color-primary;
  padding: $spacing-small $spacing-medium;
  font-family: $font-family;
  font-size: $font-size-body;
}
```

## Example 3: Getting Design Feedback

### Scenario
You want to get feedback and improvement suggestions for a specific component in your Figma design.

### Steps

1. In Cursor, start a conversation with Claude
2. Ask: "Suggest improvements for the login form in my Figma design"
3. Claude will use the MCP server to:
   - Access the login form component
   - Analyze the design
   - Provide feedback and suggestions

### Example Conversation

**You**: Suggest improvements for the login form in my Figma design

**Claude**: I'll analyze your login form design and suggest improvements. Let me check your Figma files.

I found the login form component in your design: "Website - Login Form"

Here are my suggestions for improving the login form:

1. **Accessibility Improvements**:
   - Increase the color contrast between the input text and background to meet WCAG AA standards
   - Add visible labels above each input field instead of just using placeholders
   - Include error states with clear error messages
   - Add focus states for keyboard navigation

2. **Usability Enhancements**:
   - Add a "Forgot Password" link near the password field
   - Consider adding social login options (Google, Apple, etc.)
   - Add a "Remember Me" checkbox option
   - Make the submit button full-width for better mobile usability

3. **Visual Design Refinements**:
   - Add subtle shadows or borders to input fields for better visual hierarchy
   - Consider using a slightly larger font size for better readability
   - Add micro-interactions (subtle animations) for form submission
   - Ensure consistent spacing between all elements

4. **Modern Design Practices**:
   - Add a password visibility toggle
   - Consider using a multi-step form for complex registrations
   - Add loading states for the submit button
   - Implement autofill support with proper styling

Would you like me to elaborate on any of these suggestions or provide specific code examples for implementing them? 