# Microsoft Clarity Product Analyst

AI-assisted product analytics pipeline for **Microsoft Clarity** that transforms behavioral session data into actionable UX and product insights.

The project collects Clarity analytics, normalizes session data, detects user-friction signals, compares historical behavior, and uses structured AI analysis to help identify product issues and opportunities.

## 🎯 Project Goal

Microsoft Clarity provides valuable behavioral data such as session recordings, rage clicks, dead clicks, navigation patterns, and engagement metrics.

The challenge is turning that data into product decisions.

This project creates a repeatable workflow:

```text
Microsoft Clarity
        ↓
Session & Analytics Data
        ↓
Collection
        ↓
Normalization
        ↓
Behavioral Analysis
        ↓
Historical Comparison
        ↓
AI Product Analysis
        ↓
UX Findings & Recommendations
```

The goal is to reduce manual analysis and help Product teams quickly understand:

* Where users experience friction
* Which UX issues happen repeatedly
* Which sessions deserve manual investigation
* How behavior changes over time
* What should be investigated or improved next

---

## 🔍 What the Project Analyzes

The workflow can surface behavioral signals such as:

* Rage clicks
* Dead clicks
* Excessive clicking
* High-interaction sessions
* Navigation friction
* Repeated user actions
* Abandoned user flows
* Unexpected behavior
* Potential conversion blockers
* Changes in user behavior over time

These signals are treated as **investigation triggers**, not automatic proof that a UX problem exists.

---

## 🧠 AI-Assisted Product Analysis

AI is used as an additional product-analysis layer on top of Clarity data.

Structured prompts help analyze behavioral information and convert raw analytics into:

* UX observations
* Recurring friction patterns
* Product hypotheses
* Investigation priorities
* Possible root causes
* Recommendations
* Follow-up questions for Product and UX teams

The AI layer is designed to support Product judgment rather than replace it.

---

## ⚙️ Workflow

### 1. Collect Clarity Data

The collection scripts retrieve behavioral and analytics data from Microsoft Clarity.

Examples:

```text
scripts/collect-clarity.mjs
scripts/collect-clarity-full.mjs
scripts/collect-clarity-export.mjs
```

Raw results are stored locally for further processing.

---

### 2. Normalize the Data

Raw Clarity output is converted into a more consistent structure for analysis.

```text
scripts/normalize-clarity.mjs
```

This helps separate data collection from product-analysis logic.

---

### 3. Run the Data Pipeline

The project includes PowerShell automation for running the workflow.

```text
scripts/run-data-pipeline.ps1
scripts/run-export-collection.ps1
```

---

### 4. Analyze User Behavior

The analysis layer evaluates behavioral patterns and frustration signals.

Examples of questions the system helps answer:

> Which sessions contain the strongest indicators of user frustration?

> Are users repeatedly struggling with the same interaction?

> Did UX friction increase compared with previous periods?

> Which user behavior should a Product Manager investigate first?

---

### 5. Compare Historical Data

Historical comparisons help identify whether behavioral patterns are isolated or persistent.

```text
scripts/compare-history.ps1
```

This allows analysis such as:

```text
Current period
      ↓
Previous period
      ↓
Behavioral differences
      ↓
Product interpretation
```

---

### 6. Generate Product Reports

The resulting analysis can be transformed into structured Product reports.

Reports may include:

* Key UX findings
* Behavioral signals
* Evidence
* Severity
* Product hypothesis
* Recommended action
* Investigation priority

The `reports/` directory stores generated analysis outputs.

---

## 📁 Project Structure

```text
clarity-product-analyst/
│
├── data/
│   ├── raw/
│   └── history/
│
├── prompts/
│   ├── daily-analysis.md
│   ├── daily-run.md
│   └── session-investigation.md
│
├── reports/
│
├── scripts/
│   ├── collect-clarity.mjs
│   ├── collect-clarity-full.mjs
│   ├── collect-clarity-export.mjs
│   ├── normalize-clarity.mjs
│   ├── compare-history.ps1
│   ├── run-data-pipeline.ps1
│   ├── run-export-collection.ps1
│   └── start-clarity-mcp.ps1
│
├── .gitignore
├── .mcp.json
├── package.json
├── package-lock.json
└── README.md
```

---

## 🤖 MCP Integration

The project uses an MCP-based workflow to connect analysis tooling with Microsoft Clarity-related data and automation.

The local MCP configuration is defined through:

```text
.mcp.json
```

Sensitive credentials are **not stored in the repository**.

Environment-specific credentials are stored locally in:

```text
.env
```

and excluded through `.gitignore`.

---

## 🔐 Environment Variables

Create a local `.env` file for required credentials.

Example:

```env
CLARITY_API_TOKEN=
CLARITY_PROJECT_ID=
```

Do not commit `.env` files or API credentials to GitHub.

---

## 🚀 Getting Started

Clone the repository:

```bash
git clone https://github.com/wisheradam/clarity-product-analyst.git
```

Enter the project:

```bash
cd clarity-product-analyst
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables in `.env`.

Then run the appropriate collection or pipeline script depending on the analysis workflow.

For example:

```bash
node scripts/collect-clarity.mjs
```

or:

```powershell
.\scripts\run-data-pipeline.ps1
```

---

## 📊 Example Product Finding

A typical output might look like:

### Observation

Users repeatedly click the same interface element without receiving visible feedback.

### Behavioral Signal

`Dead Click`

### Product Hypothesis

The interface suggests that the element is interactive, but either the action is unavailable or the response is not visible to the user.

### Recommended Investigation

Review:

* Click target behavior
* Loading state
* Error state
* Interaction feedback
* Visual affordance

### Possible Product Action

Improve interaction feedback or redesign the component so its behavior is clear.

---

## 💡 Product Philosophy

Analytics should not stop at dashboards.

Useful Product Analytics should help answer three questions:

**What happened?**

**Why might it be happening?**

**What should we investigate next?**

This project was designed around that principle.

---

## 🗺 Future Development

Planned and potential improvements include:

* Automated daily Product Analytics reports
* AI-generated session summaries
* Behavioral anomaly detection
* UX-friction scoring
* Session clustering
* Automatic issue categorization
* Release-before / release-after analysis
* Jira integration
* Slack notifications
* UX health dashboard
* Conversion-impact correlation
* Automated prioritization of sessions for manual review

---

## 🛡️ Privacy

Product analytics data may contain sensitive behavioral information.

The project should be used with appropriate privacy controls, including:

* Microsoft Clarity masking settings
* Data minimization
* Removal of personally identifiable information
* Secure credential management
* Anonymized datasets for public demonstrations

Real production session data should not be published in public repositories.

---

## 👤 Author

**Adam Wisher**

Head of Product | AI, Web & Mobile Products | CRM / CPQ | Digital Transformation

Building AI-assisted tools that turn behavioral and operational data into better product decisions.
