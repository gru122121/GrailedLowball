# Grailed Lowballer

An automated tool for monitoring and making offers on Grailed listings for specific designers.

## Features

- Monitors new listings for specified designers in real-time
- Automatically makes offers based on a configured percentage of the listing price
- Uses Algolia search API for efficient listing discovery
- Supports authentication with Grailed

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Grailed account

## Installation

1. Clone this repository or download the source code
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Copy `config copy.json` to `config.json`:
   ```bash
   cp "config copy.json" config.json
   ```

2. Configure the following settings in `config.json`:

### Authentication
In the `AUTH` section:
- `csrf`: Your Grailed CSRF token
- `cookie`: Your Grailed session cookie
- `deviceId`: Your device ID
- `xCsrfToken`: Your X-CSRF token

To obtain these values:
1. Log into Grailed in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Make any action on Grailed (e.g., visit a listing)
5. Look for requests to grailed.com
6. Find these values in the request headers

### Monitoring Settings
In the `GRAILED` section:
- `DESIGNER`: The designer name to monitor (e.g., "visvim")
- `MONITORING_INTERVAL`: Time between checks in milliseconds (default: 60000)
- `LOWBALL_PERCENTAGE`: Offer percentage (0.5 = 50% of listing price)

### Optional Settings
In the `OPENAI` section:
- `API_KEY`: Your OpenAI API key (optional)

## Usage

1. Start the monitoring script:
   ```bash
   node grailed-scraper.js
   ```

2. The script will:
   - Monitor new listings for the specified designer
   - Automatically make offers based on your configured percentage
   - Track seen listings to avoid duplicate offers

## Important Notes

- Use this tool responsibly and in accordance with Grailed's terms of service
- Adjust the monitoring interval to avoid rate limiting
- Keep your authentication tokens secure and never share them
- The script maintains a `seen_listings.json` file to track processed listings

## Troubleshooting

If you encounter issues:
1. Verify your authentication tokens are current
2. Check your network connection
3. Ensure you're not being rate limited by Grailed
4. Verify the designer name is spelled correctly

## Disclaimer

This tool is for educational purposes only. Use at your own risk and ensure compliance with Grailed's terms of service.