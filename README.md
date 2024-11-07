# Figma Library Report Usage

This script generates a report of components from a Figma library. It uses the Figma API to gather data about components, actions, and usages, and then generates CSV and Markdown files to document the results.

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

Run the script using Node.js, passing in the necessary options and file keys:
```bash
node generateReport.js [options] [file_key...]
```

### Options
- `--debug`: Enable debug mode. Displays additional information for troubleshooting.
- `--include-variants`: Include component variants in the report. Adds columns for `Component Variant` and `Component Key`.
- `30days | 60days | 90days | 1year | "custom[startDate endDate]"`: Specify the time range for the data. Default is `30days`.
  - For `custom`, specify the start and end dates in `YYYY-MM-DD` format, enclosed in quotes.

### Arguments
- `[file_key...]`: One or more Figma library file keys for which you want to generate a report. These can be found in the URL of the Figma file.

### Example
To generate a report for a specific Figma library file for the past 90 days, including component variants:
```bash
node generateReport.js --include-variants 90days your_file_key_here
```

To generate a report with a custom date range:
```bash
node generateReport.js "custom[2024-08-01 2024-09-01]" your_file_key_here
```

## Output
- **CSV Report**: A CSV file will be created in the `reports` folder, containing details of the components.
  - The filename follows the format: `figma_lib_report_[library_name]_YYYY-MM-DD_HH_mm_ss.csv`.
  - The columns include `Component Name`, `Total Variants`, `Usages`, `Insertions`, `Detachments`, `Updated At`, and `Created At`. When variants are included, `Component Variant` and `Component Key` are also added.
- **Markdown Log**: A Markdown file will be created in the `reports` folder, summarizing the report details.
  - The filename follows the format: `figma_lib_report_[library_name]_YYYY-MM-DD_HH_mm_ss.md`.
  - The log includes the library name, total components, total variants, generation date, time period selected, last valid week, and the execution time.

## Features
- **Date Range Customization**: Supports fixed date ranges (`30days`, `60days`, `90days`, `1year`) and a custom range where you can specify a start and end date.
- **Progress Bar**: Displays a progress bar in the terminal as the script processes each library file.
- **Data Sorting**: Components are sorted alphabetically, with those starting with the "🚫" emoji listed at the end.
- **Detailed Debugging**: The `--debug` option allows you to see the full API responses for troubleshooting purposes.

## [FUTURE] Project Structure

To improve maintainability and scalability, the project is organized into several modules, each handling a specific responsibility.

### Folder Structure
```
figma-analytics/
│
├── src/
│   ├── api/
│   │   ├── figmaClient.js         # Connects to Figma API and handles all HTTP requests.
│   │   └── paginationHelper.js    # Helper for handling pagination in API responses.
│   │
│   ├── cli/
│   │   ├── argumentsParser.js     # Parses and validates CLI arguments.
│   │   └── logger.js              # Handles console logs and debug messages.
│   │
│   ├── generators/
│   │   ├── csvGenerator.js        # Handles CSV file generation.
│   │   └── markdownGenerator.js   # Handles Markdown log file generation.
│   │
│   ├── services/
│   │   └── reportService.js       # Orchestrates the main logic for generating reports.
│   │
│   └── utils/
│       ├── dateHelper.js          # Utility functions for date manipulation.
│       └── progressBar.js         # Handles progress bar configuration.
│
├── reports/                       # Directory for storing generated CSV and Markdown reports.
│
├── .env                           # Environment configuration file.
├── .gitignore                     # File to specify ignored files and folders in Git.
├── package.json                   # Node.js dependencies and scripts.
└── README.md                      # Project documentation.
```

### Description of Modules

1. **API (src/api/)**:
   - **figmaClient.js**: Responsible for connecting to the Figma API, including all endpoints used by the application.
   - **paginationHelper.js**: Helps handle pagination when the number of results exceeds the API limit per page.

2. **CLI (src/cli/)**:
   - **argumentsParser.js**: Parses and validates command line arguments, such as options and file keys.
   - **logger.js**: Provides functions to handle logging to the console, including debug information.

3. **Generators (src/generators/)**:
   - **csvGenerator.js**: Contains logic to generate the CSV report with component details.
   - **markdownGenerator.js**: Generates a Markdown log summarizing the report.

4. **Services (src/services/)**:
   - **reportService.js**: The main service that orchestrates API requests, data aggregation, and calls to the generators.

5. **Utilities (src/utils/)**:
   - **dateHelper.js**: Utility functions for handling date calculations and formatting.
   - **progressBar.js**: Manages the progress bar shown in the terminal during report generation.

## Prerequisites
- **Node.js**: Make sure you have Node.js installed.
- **Figma API Token**: You need a Figma API token with the appropriate permissions (`library_analytics:read`). [Generate Figma API Key](https://www.figma.com/developers/api#access-tokens)

## Notes
- Ensure your Figma account has access to the files being queried, as the script respects the permissions of the user making the API request.
- The API responses are paginated, and the script automatically handles pagination if there are more than 1,000 components.

## License
This project is licensed under the MIT License.

