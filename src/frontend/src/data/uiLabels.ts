export interface UILabels {
  // Sidebar nav labels
  navDashboard: string;
  navEmployees: string;
  navSalesTrends: string;
  navFeedback: string;
  navTopPerformers: string;
  navSuggestionsIssues: string;
  navUploads: string;
  navSettings: string;

  // Page titles
  dashboardTitle: string;
  dashboardSubtitle: string;
  employeesTitle: string;
  salesTrendsTitle: string;
  feedbackTitle: string;
  topPerformersTitle: string;
  suggestionsIssuesTitle: string;
  settingsTitle: string;

  // Dashboard section headers
  issuesSectionHeader: string;
  suggestionsSectionHeader: string;
  topPerformersSectionHeader: string;

  // Dashboard stat cards
  statTotalEmployees: string;
  statTotalSales: string;
  statAvgCes: string;
  statActiveCount: string;

  // Feedback tab labels
  callingRecordsTab: string;
  customerReviewsTab: string;
}

export const DEFAULT_UI_LABELS: UILabels = {
  navDashboard: "Dashboard",
  navEmployees: "Employees",
  navSalesTrends: "Sales Trends",
  navFeedback: "Feedback",
  navTopPerformers: "Top Performers",
  navSuggestionsIssues: "Suggestions & Issues",
  navUploads: "Uploads",
  navSettings: "Settings",

  dashboardTitle: "Frootle India Pvt.Ltd.",
  dashboardSubtitle:
    "People Understanding and Lifestyle Evaluation | Personality & Routine Insight Mapping",
  employeesTitle: "Employees",
  salesTrendsTitle: "Sales Trends",
  feedbackTitle: "Feedback",
  topPerformersTitle: "Top Performers",
  suggestionsIssuesTitle: "Suggestions & Issues",
  settingsTitle: "Settings",

  issuesSectionHeader: "Issues",
  suggestionsSectionHeader: "Suggestions",
  topPerformersSectionHeader: "Top Performers",

  statTotalEmployees: "Total Employees",
  statTotalSales: "Total Sales",
  statAvgCes: "Avg CES Score",
  statActiveCount: "Active",

  callingRecordsTab: "Calling Records",
  customerReviewsTab: "Customer Reviews",
};
