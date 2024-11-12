# Figma Library Report Usage

This script generates a report of components from a Figma library. It uses the Figma API to gather data about components, actions, and usages, and then generates CSV and Markdown files to document the results.

## ⚠️ Important: Plan Requirements

This script requires a **Figma Enterprise Plan** due to its use of the Analytics Beta API. The following features are only available in the Enterprise plan:

- Library Analytics API (Beta)
- REST API for Variables
- Advanced API Access
- Activity Log API

### Plan Comparison for API Features

| Feature                    | Professional | Organization | Enterprise |
|---------------------------|--------------|--------------|------------|
| Basic REST API            | ✓            | ✓            | ✓          |
| Webhooks                  | ✓            | ✓            | ✓          |
| Library Analytics         | ✗            | Basic        | Full + API |
| Variables API             | ✗            | ✗            | ✓          |
| Activity Log API          | ✗            | ✗            | ✓          |
| Private Plugins           | ✗            | ✓            | ✓          |

## Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:bellentani/figma-analytics.git
   cd figma-analytics
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with your Figma API token:
   ```env
   FIGMA_TOKEN=your_figma_api_token_here
   ```

   You can find more information on how to generate a Figma API key here: [Figma API Key Documentation](https://www.figma.com/developers/api#access-tokens)

## Usage

Run the script using Node.js:
```bash
node generateReport.js --files="file_key1,file_key2" --period="30d"
```

### Options
- `--files`: Required. Comma-separated list of Figma library file keys.
- `--period`: Optional. Analysis period (default: "30d")
  - Valid options: "30d", "60d", "90d", "1y"
  - For custom period, use: "custom[YYYY-MM-DD,YYYY-MM-DD]"
- `--debug`: Optional. Enable debug mode for additional logging.

### Example Commands
```bash
# Generate report for single file with default period (30d)
node generateReport.js --files="your_file_key_here"

# Generate report for multiple files with specific period
node generateReport.js --files="file_key1,file_key2" --period="90d"

# Generate report with custom date range
node generateReport.js --files="your_file_key_here" --period="custom[2024-01-01,2024-02-01]"
```

## Output Files

### CSV Report
Generated in the `reports` folder with filename format:
```
report_library-name_period_YYYY-MM-DD-HH-mm.csv
```

Columns:
- Component Name
- Total Variants (N/A for single components)
- Usages (total)
- Insertions (period)
- Detachments (period)
- Type (Set/Single)
- Updated At (YYYY-MM-DD-HH-mm)
- Created At (YYYY-MM-DD-HH-mm)

### Markdown Log
Generated alongside the CSV with the same name pattern but .md extension, containing:
- Library name
- Total components
- Report generation date
- Time period analyzed
- Execution time

## Component Types
- **Single**: Components with only one variant (Total Variants shown as "N/A")
- **Set**: Components with multiple variants (Total Variants shows actual count)

## Notes
- Actions (insertions/detachments) are consolidated by:
  - Component Set Name for Sets
  - Component Name for Singles
- Detachments show "0" when no detachments occurred (not "N/A")
- The script processes multiple files sequentially
- Each file generates its own CSV and MD report
- Debug mode provides detailed API response information

## Prerequisites
- Node.js
- Figma Enterprise Plan
- Figma API Token with `library_analytics:read` permission

## API Rate Limits
- Enterprise accounts have higher rate limits for API calls
- Contact Figma support for specific rate limit information for your account
- The script includes automatic retry logic for rate-limited requests

## Known Limitations
1. Library Analytics API is in beta and subject to change
2. Some features may require additional Enterprise plan features
3. API access patterns may be monitored and rate-limited based on usage

## Pricing Information
For current pricing and plan comparison, visit [Figma Pricing Page](https://www.figma.com/pricing/).

## License
This project is licensed under the MIT License.

