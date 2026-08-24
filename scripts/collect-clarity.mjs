import "dotenv/config";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const token = process.env.CLARITY_API_TOKEN;

if (!token) {
  console.error("ERROR: CLARITY_API_TOKEN is not configured.");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "C:\\Program Files\\nodejs\\npx.cmd",
  args: ["-y", "@microsoft/clarity-mcp-server"],
  env: {
    ...process.env,
    CLARITY_API_TOKEN: token,
  },
});

const client = new Client(
  {
    name: "clarity-product-analyst-collector",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

try {
  console.log("Connecting to Microsoft Clarity MCP...");

  await client.connect(transport);

  const result = await client.listTools();
  const toolNames = result.tools.map((tool) => tool.name);

  console.log("Connected.");
  console.log("Available tools:", toolNames.join(", "));

  const analyticsTool = "query-analytics-dashboard";

  if (!toolNames.includes(analyticsTool)) {
    throw new Error(`${analyticsTool} tool is not available.`);
  }

  console.log("Querying LIVE Clarity dashboard...");

  const response = await client.callTool({
    name: analyticsTool,
    arguments: {
      query: "Total page views for non-bot users in the last 24 hours",
    },
  });

  if (response.isError) {
    throw new Error(
      `Clarity returned an error: ${JSON.stringify(response.content)}`
    );
  }

  console.log("\n=== LIVE CLARITY RESULT ===");

  if (!response.content || response.content.length === 0) {
    console.log("Clarity returned no content.");
  } else {
    for (const item of response.content) {
      if (item.type === "text") {
        console.log(item.text);
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    }
  }

  console.log("==========================");
} catch (error) {
  console.error("\nCollector failed:");
  console.error(error?.message ?? error);
  process.exitCode = 1;
} finally {
  await client.close();
}