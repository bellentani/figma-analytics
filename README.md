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
- `30days | 60days | 90days | 1year | custom`: Specify the time range for the data. Default is `30days`.
  - For `custom`, the script will prompt you to enter a start date and an end date in `YYYY-MM-DD` format.

### Arguments
- `[file_key...]`: One or more Figma library file keys for which you want to generate a report. These can be found in the URL of the Figma file.

### Example
To generate a report for a specific Figma library file for the past 90 days, including component variants:
```bash
node figma_library_report.js --include-variants 90days your_file_key_here
```

## Output
- **CSV Report**: A CSV file will be created in the `reports` folder, containing details of the components.
  - The filename follows the format: `figma_lib_report_[library_name]_YYYY-MM-DD_HH_mm_ss.csv`.
  - The columns include `Component Name
