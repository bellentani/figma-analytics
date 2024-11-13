# Figma Library Report Usage

This script generates a report of components from a Figma library, creating both CSV reports and Notion databases with usage analytics data.

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
   Create a `.env` file in the root directory:
   ```env
   FIGMA_TOKEN=your_figma_api_token_here
   NOTION_TOKEN=your_notion_token_here  # optional
   ```

## Usage

### Basic Usage (CSV Report)
```bash
npm run report files="fileId1,fileId2" period="30d"
```

### With Notion Integration
```bash
npm run report files="fileId1" period="30d" notion="notion_page_id" --debug
```

### Options
- `files`: Required. Comma-separated Figma file IDs
- `period`: Optional. Analysis period (default: "30d")
  - Valid options: "30d", "60d", "90d", "1y"
  - Custom: "custom[YYYY-MM-DD,YYYY-MM-DD]"
- `notion`: Optional. Notion page ID for database creation
- `--debug`: Optional. Enable debug logs

### Command Format
- Parameters with values: `parameter="value"`
- Boolean flags: `--flag`

Examples:
```bash
# Basic report
npm run report files="tmTpuPqySUPu53Eqc16A76"

# Multiple files with custom period
npm run report files="id1,id2,id3" period="90d"

# With Notion and debug
npm run report files="fileId" notion="pageId" --debug

# Custom date range
npm run report files="fileId" period="custom[2024-01-01,2024-02-01]"
```

## Output Files

### CSV Report
Generated in the `reports` folder with filename format:
```
report_library-name_period_YYYY-MM-DD-HH-mm.csv
```

### Notion Database
- Name: `Figma Component Report - {file name} - {YYYY-MM-DD - HH-MM} - {period}`
- Columns:
  1. Component Name
  2. Total Variants
  3. Usages
  4. Insertions (period)
  5. Detachments (period)
  6. Created At
  7. Updated At
  8. Type

### Data Structure
Both outputs include:
- Component Name
- Total Variants (N/A for single components)
- Usages (total)
- Insertions (period)
- Detachments (period)
- Type (Set/Single)
- Updated At (YYYY-MM-DD-HH-mm)
- Created At (YYYY-MM-DD-HH-mm)

## Notion Integration Setup

1. Create a Notion integration:
   - Go to [Notion Developers](https://www.notion.so/my-integrations)
   - Create new integration
   - Copy token to `.env` file
2. Share your Notion page with the integration
3. Get the page ID from the URL

### Notion Database Features
- Automatic sorting by Component Name
- Numeric prefixes in column names to maintain order
- Real-time updates during report generation

## Component Types
- **Single**: Components with only one variant (Total Variants shown as "N/A")
- **Set**: Components with multiple variants (Total Variants shows actual count)

## Notes
- Actions (insertions/detachments) are consolidated by:
  - Component Set Name for Sets
  - Component Name for Singles
- Detachments show "0" when no detachments occurred (not "N/A")
- The script processes multiple files sequentially
- Each file generates its own CSV and Notion database
- Debug mode provides detailed API response information

## Prerequisites
- Node.js >= 16.0.0
- Figma Enterprise Plan
- Figma API Token with `library_analytics:read` permission
- Notion account and integration (optional)

## API Rate Limits
- Figma Enterprise accounts have higher rate limits
- Notion API has a limit of 100 requests per minute
- The script includes automatic retry logic for rate-limited requests

## Known Limitations
1. Library Analytics API is in beta and subject to change
2. Some features require Enterprise plan features
3. API access patterns may be monitored and rate-limited
4. Notion columns maintain numeric prefixes for ordering
5. Custom date ranges must be within the last year

## Pricing Information
For current pricing and plan comparison, visit [Figma Pricing Page](https://www.figma.com/pricing/).

## License
This project is licensed under the MIT License.