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

