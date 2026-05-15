/**
 * N8N AGENT — Workflow automation manager for n8n Cloud
 *
 * Handles all n8n API operations:
 *   - CRUD on workflows
 *   - Activation / deactivation
 *   - Manual execution triggers
 *   - Execution history
 *   - Ottoflow-specific workflow builder
 *
 * Cloud URL:  https://ottoflow.app.n8n.cloud
 * API base:   https://ottoflow.app.n8n.cloud/api/v1
 * Auth:       X-N8N-API-KEY header
 */

// ─── Types ───────────────────────────────────────────────────

export interface N8nWorkflow {
  id:        string;
  name:      string;
  active:    boolean;
  createdAt: string;
  updatedAt: string;
  nodes?:    N8nNode[];
}

export interface N8nNode {
  id:          string;
  name:        string;
  type:        string;
  typeVersion: number;
  position:    [number, number];
  parameters:  Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
}

export interface N8nConnections {
  [nodeName: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
    ai_languageModel?: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

export interface N8nExecution {
  id:         string;
  workflowId: string;
  status:     "success" | "error" | "running" | "waiting";
  startedAt:  string;
  stoppedAt?: string;
}

export interface CreateWorkflowPayload {
  name:        string;
  nodes:       N8nNode[];
  connections: N8nConnections;
  settings?:   Record<string, unknown>;
  projectId?:  string;
}

// ─── N8n Agent ────────────────────────────────────────────────

export class N8nAgent {
  private baseUrl:  string;
  private apiKey:   string;
  private projectId: string;

  constructor() {
    this.apiKey    = process.env.N8N_API_KEY    || "";
    this.baseUrl   = process.env.N8N_BASE_URL   || "https://ottoflow.app.n8n.cloud";
    this.projectId = process.env.N8N_PROJECT_ID || "3oBJRXrafchYWlAs";

    if (!this.apiKey) throw new Error("N8N_API_KEY not set in .env");
  }

  // ─── API Base ─────────────────────────────────────────────

  private async call<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-N8N-API-KEY": this.apiKey,
        "Content-Type":  "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`n8n API ${method} ${endpoint} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Workflow CRUD ────────────────────────────────────────

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const data = await this.call<{ data: N8nWorkflow[] }>("GET", "/workflows");
    return data.data || [];
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.call<N8nWorkflow>("GET", `/workflows/${id}`);
  }

  async createWorkflow(payload: CreateWorkflowPayload): Promise<N8nWorkflow> {
    const body: Record<string, unknown> = { ...payload };
    if (this.projectId) body.projectId = this.projectId;
    return this.call<N8nWorkflow>("POST", "/workflows", body);
  }

  async updateWorkflow(id: string, payload: Partial<CreateWorkflowPayload>): Promise<N8nWorkflow> {
    return this.call<N8nWorkflow>("PUT", `/workflows/${id}`, payload);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.call<void>("DELETE", `/workflows/${id}`);
  }

  async activateWorkflow(id: string): Promise<void> {
    await this.call<void>("POST", `/workflows/${id}/activate`);
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.call<void>("POST", `/workflows/${id}/deactivate`);
  }

  // ─── Executions ───────────────────────────────────────────

  async getExecutions(workflowId?: string, limit = 10): Promise<N8nExecution[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (workflowId) params.set("workflowId", workflowId);
    const data = await this.call<{ data: N8nExecution[] }>("GET", `/executions?${params}`);
    return data.data || [];
  }

  async getExecution(id: string): Promise<N8nExecution> {
    return this.call<N8nExecution>("GET", `/executions/${id}`);
  }

  // ─── Ottoflow Video Hub Workflow Builder ──────────────────

  /**
   * Create the Ottoflow Video Hub — Content Processor workflow in n8n.
   *
   * Flow: Manual Trigger → Read Pending Rows → (foreach row)
   *       Generate Script (if missing) → Generate Hooks → SEO Captions
   *       → Update Sheet with Script + Hooks + Status = "Script Ready"
   *
   * Reuses existing credentials from "Ottoflow Cloud MVP":
   *   - Google Sheets: I12pdRDjeKOwy8oP  ("Google Sheets Otto")
   *   - Anthropic:     OW3osAKurnQSC7S1  ("Anthropic account otto")
   */
  async createOttoflowWorkflow(): Promise<N8nWorkflow> {
    const SHEETS_CRED   = { id: "I12pdRDjeKOwy8oP", name: "Google Sheets Otto" };
    const ANTHROPIC_CRED = { id: "OW3osAKurnQSC7S1", name: "Anthropic account otto" };
    const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "1vxzv5oo64gsu95KhdLvzE50Snpvk4d7luTDKmjCbcGg";

    const nodes: N8nNode[] = [
      // 1. Manual Trigger
      {
        id: "node-trigger", name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger", typeVersion: 1,
        position: [0, 300], parameters: {},
      },

      // 2. Read all Pending rows from our sheet
      {
        id: "node-read-sheet", name: "Get Pending Rows",
        type: "n8n-nodes-base.googleSheets", typeVersion: 4,
        position: [240, 300],
        parameters: {
          documentId: { __rl: true, value: SPREADSHEET_ID, mode: "id" },
          sheetName:  { __rl: true, value: "gid=0", mode: "id" },
          filtersUI:  { values: [{ lookupColumn: "Status", lookupValue: "Pending" }] },
          options:    {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },

      // 3. Update status to Processing (mark each row so parallel runs skip it)
      {
        id: "node-mark-processing", name: "Mark Processing",
        type: "n8n-nodes-base.googleSheets", typeVersion: 4,
        position: [480, 300],
        parameters: {
          operation:  "update",
          documentId: { __rl: true, value: SPREADSHEET_ID, mode: "id" },
          sheetName:  { __rl: true, value: "gid=0", mode: "id" },
          columns: {
            mappingMode: "defineBelow",
            value: {
              Status:     "Processing",
              "Updated At": "={{ $now.toISO() }}",
              row_number:  0,
            },
            matchingColumns: ["row_number"],
          },
          options: {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },

      // 4. Prepare context — extract fields cleanly
      {
        id: "node-context", name: "Prepare Context",
        type: "n8n-nodes-base.set", typeVersion: 3,
        position: [720, 300],
        parameters: {
          options: {},
          assignments: {
            assignments: [
              { name: "topic",      value: "={{ $json.Topic }}",     type: "string" },
              { name: "style",      value: "={{ $json.Style }}",     type: "string" },
              { name: "script",     value: "={{ $json.Script }}",    type: "string" },
              { name: "hookA",      value: "={{ $json['Hook A'] }}", type: "string" },
              { name: "hookB",      value: "={{ $json['Hook B'] }}", type: "string" },
              { name: "hookC",      value: "={{ $json['Hook C'] }}", type: "string" },
              { name: "row_number", value: "={{ $json.row_number }}", type: "number" },
            ],
          },
        },
      },

      // 5. IF: script missing?
      {
        id: "node-check-script", name: "Script Missing?",
        type: "n8n-nodes-base.if", typeVersion: 2,
        position: [960, 300],
        parameters: {
          conditions: {
            options: { caseSensitive: false, leftValue: "", typeValidation: "loose", version: 1 },
            conditions: [
              {
                id: "cond1",
                leftValue:  "={{ $json.script }}",
                rightValue: "",
                operator:   { type: "string", operation: "equals" },
              },
            ],
            combinator: "and",
          },
        },
      },

      // 6a. TRUE: Generate script with Claude
      {
        id: "node-gen-script", name: "Generate Script",
        type: "@n8n/n8n-nodes-langchain.chainLlm", typeVersion: 1.5,
        position: [1200, 180],
        parameters: {
          promptType: "define",
          text: `=You are an elite short-form video scriptwriter.

TOPIC: {{ $json.topic }}
STYLE: {{ $json.style }}
EXISTING HOOKS: {{ $json.hookA || '(none)' }}, {{ $json.hookB || '(none)' }}, {{ $json.hookC || '(none)' }}

Write a complete content package. Output ONLY valid JSON:
{
  "script": "60-80 word voiceover. Natural spoken language. Opens with hook, delivers one insight, ends with soft CTA.",
  "hookA": "Pain-point hook, max 8 words",
  "hookB": "Fact or number hook, max 8 words",
  "hookC": "Direct you-language hook, max 8 words",
  "wordCount": 72
}`,
          messages: {
            messageValues: [
              { message: "You write authentic, engaging short-form video scripts. Output only valid JSON." },
            ],
          },
        },
      },

      // 6b. TRUE: Anthropic model for script
      {
        id: "node-model-script", name: "Anthropic (Script)",
        type: "@n8n/n8n-nodes-langchain.lmChatAnthropic", typeVersion: 1.2,
        position: [1200, 60],
        parameters: {
          model: "claude-haiku-4-5-20251001",
          options: { maxTokensToSample: 1024, temperature: 0.7 },
        },
        credentials: { anthropicApi: ANTHROPIC_CRED },
      },

      // 7a. TRUE: Parse script JSON
      {
        id: "node-parse-script", name: "Parse Script",
        type: "n8n-nodes-base.set", typeVersion: 3,
        position: [1440, 180],
        parameters: {
          options: {},
          assignments: {
            assignments: [
              { name: "script", value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).script }}", type: "string" },
              { name: "hookA",  value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).hookA }}", type: "string" },
              { name: "hookB",  value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).hookB }}", type: "string" },
              { name: "hookC",  value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).hookC }}", type: "string" },
            ],
          },
        },
      },

      // 6c. FALSE branch — pass through existing script
      {
        id: "node-passthrough", name: "Use Existing Script",
        type: "n8n-nodes-base.set", typeVersion: 3,
        position: [1200, 420],
        parameters: {
          options: {},
          assignments: {
            assignments: [
              { name: "script", value: "={{ $json.script }}", type: "string" },
              { name: "hookA",  value: "={{ $json.hookA }}",  type: "string" },
              { name: "hookB",  value: "={{ $json.hookB }}",  type: "string" },
              { name: "hookC",  value: "={{ $json.hookC }}",  type: "string" },
            ],
          },
        },
      },

      // 8. Merge both branches
      {
        id: "node-merge", name: "Merge",
        type: "n8n-nodes-base.merge", typeVersion: 3,
        position: [1680, 300],
        parameters: { mode: "passThrough", output: "input1" },
      },

      // 9. Generate SEO with Claude
      {
        id: "node-gen-seo", name: "Generate SEO",
        type: "@n8n/n8n-nodes-langchain.chainLlm", typeVersion: 1.5,
        position: [1920, 300],
        parameters: {
          promptType: "define",
          text: `=TOPIC: {{ $json.topic }}
STYLE: {{ $json.style }}
HOOK: {{ $json.hookA }}
SCRIPT: {{ $json.script.slice(0, 400) }}

Output ONLY valid JSON:
{
  "title": "Viral title under 70 chars",
  "description": "Engaging 200-char caption with emojis",
  "hashtags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"],
  "cta": "Clear call to action under 60 chars"
}`,
          messages: {
            messageValues: [
              { message: "You are a viral social media content strategist. Output only valid JSON." },
            ],
          },
        },
      },

      // 9b. Anthropic model for SEO
      {
        id: "node-model-seo", name: "Anthropic (SEO)",
        type: "@n8n/n8n-nodes-langchain.lmChatAnthropic", typeVersion: 1.2,
        position: [1920, 160],
        parameters: {
          model: "claude-haiku-4-5-20251001",
          options: { maxTokensToSample: 512, temperature: 0.7 },
        },
        credentials: { anthropicApi: ANTHROPIC_CRED },
      },

      // 10. Parse SEO
      {
        id: "node-parse-seo", name: "Parse SEO",
        type: "n8n-nodes-base.set", typeVersion: 3,
        position: [2160, 300],
        parameters: {
          options: {},
          assignments: {
            assignments: [
              { name: "seoTitle",    value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).title }}", type: "string" },
              { name: "seoDesc",     value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).description }}", type: "string" },
              { name: "seoHashtags", value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).hashtags.map(h => '#' + h).join(' ') }}", type: "string" },
              { name: "seoCta",      value: "={{ JSON.parse($json.text.replace(/^```json?\\n?/, '').replace(/\\n?```$/, '')).cta }}", type: "string" },
            ],
          },
        },
      },

      // 11. Write everything back to the sheet
      {
        id: "node-save", name: "Save to Sheet",
        type: "n8n-nodes-base.googleSheets", typeVersion: 4,
        position: [2400, 300],
        parameters: {
          operation:  "update",
          documentId: { __rl: true, value: SPREADSHEET_ID, mode: "id" },
          sheetName:  { __rl: true, value: "gid=0", mode: "id" },
          columns: {
            mappingMode: "defineBelow",
            value: {
              Script:     "={{ $json.script }}",
              "Hook A":   "={{ $json.hookA }}",
              "Hook B":   "={{ $json.hookB }}",
              "Hook C":   "={{ $json.hookC }}",
              Status:     "Script Ready",
              "Updated At": "={{ $now.toISO() }}",
              row_number:  0,
            },
            matchingColumns: ["row_number"],
          },
          options: {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },
    ];

    const connections: N8nConnections = {
      "Manual Trigger":    { main: [[{ node: "Get Pending Rows",     type: "main", index: 0 }]] },
      "Get Pending Rows":  { main: [[{ node: "Mark Processing",      type: "main", index: 0 }]] },
      "Mark Processing":   { main: [[{ node: "Prepare Context",      type: "main", index: 0 }]] },
      "Prepare Context":   { main: [[{ node: "Script Missing?",      type: "main", index: 0 }]] },
      "Script Missing?": {
        main: [
          [{ node: "Generate Script",    type: "main", index: 0 }],  // TRUE
          [{ node: "Use Existing Script", type: "main", index: 0 }], // FALSE
        ],
      },
      "Anthropic (Script)":   { ai_languageModel: [[{ node: "Generate Script", type: "ai_languageModel", index: 0 }]] },
      "Generate Script":       { main: [[{ node: "Parse Script",       type: "main", index: 0 }]] },
      "Parse Script":          { main: [[{ node: "Merge",              type: "main", index: 0 }]] },
      "Use Existing Script":   { main: [[{ node: "Merge",              type: "main", index: 1 }]] },
      "Merge":                 { main: [[{ node: "Generate SEO",       type: "main", index: 0 }]] },
      "Anthropic (SEO)":       { ai_languageModel: [[{ node: "Generate SEO",    type: "ai_languageModel", index: 0 }]] },
      "Generate SEO":          { main: [[{ node: "Parse SEO",          type: "main", index: 0 }]] },
      "Parse SEO":             { main: [[{ node: "Save to Sheet",      type: "main", index: 0 }]] },
    };

    return this.createWorkflow({
      name:        "Ottoflow Video Hub — Content Processor",
      nodes,
      connections,
      settings:    { executionOrder: "v1" },
      projectId:   this.projectId,
    });
  }

  /**
   * Print a summary of all workflows to console.
   */
  async listAndPrint(): Promise<void> {
    const workflows = await this.listWorkflows();
    console.log(`\n[n8n] ${workflows.length} workflow(s) in project ${this.projectId}:`);
    for (const w of workflows) {
      const status = w.active ? "🟢 Active" : "⚪ Inactive";
      console.log(`  ${status}  ${w.id}  ${w.name}  (updated ${new Date(w.updatedAt).toLocaleDateString()})`);
    }
  }
}
