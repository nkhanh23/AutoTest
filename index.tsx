import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";

// --- Types ---

interface AutomationConfig {
  type: "HTTP_SMOKE" | "UI_E2E" | "NONE";
  method?: "GET" | "POST" | "NONE";
  url_path?: string;
  notes?: string;
  assertions?: Array<{ kind: string; op: string; value: any }>;
}

interface TestCase {
  No: string;
  TestSenario: string;
  TestCase: string;
  "Pre-Condition": string;
  Steps: string;
  "Data Test": string;
  "Expected result": string;
  "Actural Result": string;
  Status: "Pass" | "Fail" | "N/A" | "Block";
  Priority: "High" | "Medium" | "Low";
  automation?: AutomationConfig;
}

interface TestData {
  project_title: string;
  base_url: string;
  assumptions: string[];
  testcases: TestCase[];
}

// --- Styles ---

const styles = {
  container: {
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "#f4f4f9",
    minHeight: "100vh",
    padding: "20px",
    color: "#000",
  },
  header: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    marginBottom: "20px",
    borderLeft: "5px solid #d32f2f",
  },
  title: {
    margin: 0,
    color: "#d32f2f",
    fontSize: "24px",
    fontWeight: "bold",
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#444",
    fontSize: "14px",
  },
  inputSection: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "4px",
    border: "1px solid #aaa",
    fontSize: "16px",
    color: "#000",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#d32f2f",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    transition: "background 0.2s",
    whiteSpace: "nowrap" as const,
  },
  secondaryButton: {
    padding: "8px 16px",
    backgroundColor: "#1976d2", // Blue
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    marginLeft: "10px",
    whiteSpace: "nowrap" as const,
  },
  downloadButton: {
    padding: "8px 16px",
    backgroundColor: "#2e7d32", // Green for Excel
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    marginLeft: "10px",
    whiteSpace: "nowrap" as const,
  },
  tabContainer: {
    display: "flex",
    gap: "2px",
    marginBottom: "0",
    alignItems: "center",
  },
  tab: (active: boolean) => ({
    padding: "12px 24px",
    backgroundColor: active ? "#fff" : "#e0e0e0",
    cursor: "pointer",
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    fontWeight: active ? "bold" : "normal",
    color: active ? "#d32f2f" : "#333",
    userSelect: "none" as const,
    borderBottom: active ? "none" : "1px solid #ccc",
  }),
  contentArea: {
    backgroundColor: "#fff",
    padding: "20px",
    borderBottomLeftRadius: "8px",
    borderBottomRightRadius: "8px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    minHeight: "500px",
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13px",
  },
  th: {
    backgroundColor: "#e0e0e0",
    color: "#000",
    padding: "10px",
    border: "1px solid #999",
    textAlign: "center" as const,
    fontWeight: "bold",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "8px",
    border: "1px solid #bbb",
    verticalAlign: "top",
    color: "#000",
  },
  tdMerged: {
    padding: "8px",
    border: "1px solid #bbb",
    verticalAlign: "middle", 
    color: "#000",
    backgroundColor: "#fafafa",
    fontWeight: "bold",
  },
  codeBlock: {
    backgroundColor: "#1e1e1e",
    color: "#dcdcdc",
    padding: "20px",
    borderRadius: "8px",
    fontFamily: "Consolas, Monaco, 'Andale Mono', monospace",
    fontSize: "14px",
    whiteSpace: "pre-wrap" as const,
    overflowX: "auto" as const,
  },
  loading: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#333",
    fontSize: "18px",
  },
  badge: (priority: string) => {
    let bg = "#757575";
    if (priority === "High") bg = "#b71c1c";
    if (priority === "Medium") bg = "#e65100";
    if (priority === "Low") bg = "#1b5e20";
    return {
      backgroundColor: bg,
      color: "#fff",
      padding: "2px 6px",
      borderRadius: "4px",
      fontSize: "11px",
      fontWeight: "bold",
    };
  },
  statusBadge: (status: string) => {
    let bg = "#9e9e9e"; // N/A
    if (status === "Pass") bg = "#2e7d32";
    if (status === "Fail") bg = "#c62828";
    return {
      backgroundColor: bg,
      color: "#fff",
      padding: "4px 8px",
      borderRadius: "4px",
      fontWeight: "bold",
    }
  },
  guideBox: {
    backgroundColor: "#e3f2fd",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "15px",
    border: "1px solid #90caf9",
    color: "#0d47a1"
  }
};

// --- App Component ---

const App = () => {
  const [url, setUrl] = useState("https://movie-streaming-demo.vercel.app");
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"EXCEL" | "PLAYWRIGHT" | "JSON" | "IMPORT">("EXCEL");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateTests = async () => {
    if (!process.env.API_KEY) {
      setError("Thiếu API Key trong biến môi trường.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemPrompt = `
        You are a Senior QA Automation Engineer and Business Analyst.
        Your task is to analyze a movie streaming website URL and generate a comprehensive test suite.
        
        STRICT REQUIREMENT: GROUPING & NUMBERING
        You must group test cases by the following Modules (if the page exists).
        For each module, use the specific ID Prefix and merge the 'TestSenario' field (keep it identical for all cases in the group).
        
        Modules & Prefixes:
        1. Trang Đăng ký (Register) -> Prefix: RG_xx
        2. Trang Đăng nhập (Login) -> Prefix: LG_xx
        3. Trang chủ (Home) -> Prefix: HM_xx
        4. Trang Danh sách phim / Phân loại (Category) -> Prefix: CT_xx
        5. Trang Tìm kiếm (Search) -> Prefix: SE_xx
        6. Trang Chi tiết phim (Movie Detail) -> Prefix: DT_xx
        7. Trang Xem phim (Player) -> Prefix: PL_xx
        8. Trang Tài khoản / Hồ sơ (Profile) -> Prefix: PF_xx
        9. Trang 404 / Lỗi -> Prefix: ER_xx

        Sort Order within each Module:
        1. Happy Path
        2. Validation
        3. Negative / Edge cases
        4. Security

        Language:
        All content values MUST BE IN VIETNAMESE.
        
        Output Schema:
        Output MUST be valid JSON following the schema.
        Use 'HTTP_SMOKE' for simple page loads/html checks.
        Use 'UI_E2E' for complex interactions (Login, Search, Player controls).
      `;

      const userPrompt = `
        Target Website: ${url}

        Generate a JSON object with this schema:
        {
          "project_title": "string (in Vietnamese)",
          "base_url": "string",
          "assumptions": ["string (in Vietnamese)"],
          "testcases": [
            {
              "No": "RG_01 (Prefix depends on module)",
              "TestSenario": "Trang Đăng ký (MUST BE SAME FOR ALL CASES IN MODULE)",
              "TestCase": "string (in Vietnamese)",
              "Pre-Condition": "string (in Vietnamese)",
              "Steps": "string (in Vietnamese - use bullet points)",
              "Data Test": "string (in Vietnamese)",
              "Expected result": "string (in Vietnamese)",
              "Actural Result": "",
              "Status": "N/A",
              "Priority": "High|Medium|Low",
              "automation": {
                "type": "HTTP_SMOKE|UI_E2E",
                "method": "GET|POST|NONE",
                "url_path": "string",
                "notes": "string (Playwright code snippet)"
              }
            }
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
        ],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text;
      if (!text) throw new Error("Không nhận được phản hồi từ AI");
      
      const parsedData = JSON.parse(text) as TestData;
      setData(parsedData);

    } catch (err: any) {
      setError(err.message || "Không thể tạo test case.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const resultText = evt.target?.result as string;
            const report = JSON.parse(resultText);
            
            // Map to store results by ID
            const resultsMap = new Map<string, {status: "Pass" | "Fail", message: string}>();

            // Recursively find tests in report
            const processSuite = (suite: any) => {
                if (suite.specs) {
                    suite.specs.forEach((spec: any) => {
                        const title = spec.title;
                        const match = title.match(/^\[(.*?)\]/); // Match [ID] at start
                        if (match) {
                            const id = match[1];
                            const testResult = spec.tests?.[0]?.results?.[0];
                            if (testResult) {
                                let status: "Pass" | "Fail" = testResult.status === "passed" ? "Pass" : "Fail";
                                let message = testResult.status === "passed" ? "Đạt (Playwright)" : "Thất bại";
                                if (testResult.error) {
                                    const errText = testResult.error.message?.split('\n')[0] || "Unknown error";
                                    message += ` | Lỗi: ${errText}`;
                                }
                                resultsMap.set(id, { status, message });
                            }
                        }
                    });
                }
                if (suite.suites) {
                    suite.suites.forEach(processSuite);
                }
            };
            
            processSuite(report);

            // Update Data
            const updatedCases = data.testcases.map(tc => {
                const res = resultsMap.get(tc.No);
                if (res) {
                    return { ...tc, Status: res.status, "Actural Result": res.message };
                }
                return tc;
            });

            setData({ ...data, testcases: updatedCases });
            alert(`Đã cập nhật ${resultsMap.size} kết quả test! Kiểm tra tab Excel View.`);
            setActiveTab("EXCEL");

        } catch (err) {
            alert("Lỗi đọc file JSON Report: " + err);
        }
    };
    reader.readAsText(file);
  };

  const downloadExcel = () => {
    if (!data) return;
    
    // Prepare Header rows
    const headerTitle = [["TESTCASE PROJECT - " + data.project_title.toUpperCase()]];
    const headerColumns = ["No", "TestSenario", "TestCase", "Pre-Condition", "Steps", "Data Test", "Expected result", "Actural Result", "Status", "Priority"];
    
    // Prepare Body rows
    const bodyRows = data.testcases.map(tc => [
      tc.No,
      tc.TestSenario,
      tc.TestCase,
      tc["Pre-Condition"],
      tc.Steps,
      tc["Data Test"],
      tc["Expected result"],
      tc["Actural Result"],
      tc.Status,
      tc.Priority
    ]);

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet([
      headerTitle,
      headerColumns,
      ...bodyRows
    ]);

    // --- MERGE LOGIC ---
    const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
    let startIndex = 0;
    const dataStartRow = 2;

    if (data.testcases.length > 0) {
      for (let i = 1; i <= data.testcases.length; i++) {
        const currentScenario = i < data.testcases.length ? data.testcases[i].TestSenario : null;
        const prevScenario = data.testcases[startIndex].TestSenario;

        if (currentScenario !== prevScenario) {
          if (i - startIndex > 1) {
            merges.push({
              s: { r: startIndex + dataStartRow, c: 1 }, 
              e: { r: i - 1 + dataStartRow, c: 1 }      
            });
          }
          startIndex = i;
        }
      }
    }
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "TestCases_Updated.xlsx");
  };

  const generatePlaywrightScript = (data: TestData) => {
    let script = `import { test, expect } from '@playwright/test';\n\n`;
    script += `const BASE_URL = '${data.base_url}';\n\n`;
    script += `test.describe('${data.project_title}', () => {\n\n`;
    script += `  test.beforeEach(async ({ page }) => {\n`;
    script += `    await page.goto(BASE_URL);\n`;
    script += `  });\n\n`;

    data.testcases.forEach((tc) => {
      if (tc.automation?.type === "UI_E2E" || tc.automation?.type === "HTTP_SMOKE") {
        const safeName = tc.TestCase.replace(/'/g, "\\'");
        // STRICT TITLE FORMAT: [ID] TestCase
        script += `  test('[${tc.No}] ${safeName}', async ({ page, request }) => {\n`;
        
        const steps = tc.Steps.split('\n').map(s => `    // ${s}`).join('\n');
        script += `${steps}\n`;
        
        script += `    // Expected: ${tc["Expected result"]}\n`;
        
        if (tc.automation.type === "HTTP_SMOKE") {
            script += `    const response = await request.${tc.automation.method?.toLowerCase() || 'get'}(\`\${BASE_URL}${tc.automation.url_path}\`);\n`;
            script += `    expect(response.status()).toBe(200);\n`;
        } else if (tc.automation.notes) {
            script += `    // Implementation Code:\n`;
            script += `    ${tc.automation.notes}\n`;
        } else {
            script += `    // TODO: Write manual steps here\n`;
        }

        script += `  });\n\n`;
      }
    });

    script += `});`;
    return script;
  };

  const generatePackageJSON = () => {
    return JSON.stringify({
      "name": "qa-automation-suite",
      "version": "1.0.0",
      "scripts": {
        "test": "playwright test",
        "report": "playwright show-report"
      },
      "devDependencies": {
        "@playwright/test": "^1.41.0",
        "@types/node": "^20.11.0"
      }
    }, null, 2);
  };

  // Helper to calculate RowSpan for React Table
  const getRowSpanMap = (testcases: TestCase[]) => {
    const map = new Map<number, number>();
    let startIndex = 0;
    
    for (let i = 1; i <= testcases.length; i++) {
        const current = i < testcases.length ? testcases[i].TestSenario : null;
        const prev = testcases[startIndex].TestSenario;

        if (current !== prev) {
            map.set(startIndex, i - startIndex);
            startIndex = i;
        }
    }
    return map;
  };

  const renderTableBody = () => {
    if (!data) return null;
    const rowSpanMap = getRowSpanMap(data.testcases);

    return data.testcases.map((tc, idx) => {
      const rowSpan = rowSpanMap.get(idx);
      const showScenario = idx === 0 || tc.TestSenario !== data.testcases[idx - 1].TestSenario;
      const spanCount = showScenario ? rowSpanMap.get(idx) : 1;

      return (
        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9f9f9" }}>
          <td style={{...styles.td, textAlign: "center"}}>{tc.No}</td>
          
          {showScenario && (
             <td 
                style={styles.tdMerged} 
                rowSpan={spanCount}
             >
               {tc.TestSenario}
             </td>
          )}
          
          <td style={styles.td}><strong>{tc.TestCase}</strong></td>
          <td style={styles.td}>{tc["Pre-Condition"]}</td>
          <td style={{...styles.td, whiteSpace: "pre-wrap"}}>{tc.Steps}</td>
          <td style={styles.td}>{tc["Data Test"]}</td>
          <td style={styles.td}>{tc["Expected result"]}</td>
          <td style={styles.td}>{tc["Actural Result"]}</td>
          <td style={{...styles.td, textAlign: "center"}}>
             <span style={styles.statusBadge(tc.Status)}>{tc.Status}</span>
          </td>
          <td style={{...styles.td, textAlign: "center"}}>
            <span style={styles.badge(tc.Priority)}>{tc.Priority}</span>
          </td>
        </tr>
      );
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>DỰ ÁN TESTCASE - TỰ ĐỘNG HÓA QA</h1>
        <p style={styles.subtitle}>Trợ lý AI Senior QA Automation + BA (Sử dụng Gemini 3.0 Pro)</p>
      </div>

      <div style={styles.inputSection}>
        <input 
          type="text" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="Nhập URL Website (ví dụ: https://phimmoizz.com)"
          style={styles.input}
        />
        <button 
          onClick={generateTests} 
          disabled={loading}
          style={{...styles.button, opacity: loading ? 0.7 : 1}}
        >
          {loading ? "Đang phân tích..." : "Tạo Test Case"}
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#ffebee", color: "#c62828", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {data && (
        <div>
          <div style={styles.tabContainer}>
            <div 
              style={styles.tab(activeTab === "EXCEL")} 
              onClick={() => setActiveTab("EXCEL")}
            >
              Xem Excel
            </div>
            <div 
              style={styles.tab(activeTab === "PLAYWRIGHT")} 
              onClick={() => setActiveTab("PLAYWRIGHT")}
            >
              Kịch bản Playwright
            </div>
            <div 
              style={styles.tab(activeTab === "IMPORT")} 
              onClick={() => setActiveTab("IMPORT")}
            >
               Cập nhật Kết quả (Run)
            </div>
            <div 
              style={styles.tab(activeTab === "JSON")} 
              onClick={() => setActiveTab("JSON")}
            >
              JSON Gốc
            </div>
             {activeTab === "EXCEL" && (
                <button onClick={downloadExcel} style={styles.downloadButton}>
                   Tải xuống .xlsx
                </button>
            )}
          </div>

          <div style={styles.contentArea}>
            {activeTab === "EXCEL" && (
              <div style={{ overflowX: "auto" }}>
                <div style={{ marginBottom: "15px" }}>
                  <strong>Dự án:</strong> {data.project_title} <br/>
                  <strong>Giả định:</strong> {data.assumptions.join(", ")}
                </div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {["No", "Kịch bản", "Test Case", "Tiền điều kiện", "Các bước", "Dữ liệu", "Mong đợi", "Thực tế", "Trạng thái", "Ưu tiên"].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renderTableBody()}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "PLAYWRIGHT" && (
              <div>
                <div style={styles.guideBox}>
                  <strong>Hướng dẫn chạy Test Local:</strong>
                  <ol style={{margin: "10px 0 0 20px"}}>
                    <li>Tạo thư mục mới trên máy tính.</li>
                    <li>Lưu file <code>package.json</code> bên dưới.</li>
                    <li>Lưu code bên dưới vào file <code>e2e.spec.ts</code>.</li>
                    <li>Chạy lệnh: <code>npm install</code></li>
                    <li>Chạy lệnh: <code>npx playwright test e2e.spec.ts --reporter=json &gt; results.json</code></li>
                    <li>Quay lại tab "Cập nhật Kết quả" và tải file <code>results.json</code> lên để cập nhật Excel.</li>
                  </ol>
                </div>
                <h3>e2e.spec.ts</h3>
                <pre style={styles.codeBlock}>
                    {generatePlaywrightScript(data)}
                </pre>
                <h3>package.json</h3>
                <pre style={styles.codeBlock}>
                    {generatePackageJSON()}
                </pre>
              </div>
            )}

            {activeTab === "IMPORT" && (
                <div style={{textAlign: 'center', padding: '40px'}}>
                    <h2>Cập nhật kết quả từ Playwright</h2>
                    <p>Sau khi chạy script Playwright dưới local, hãy tải file report JSON lên đây.</p>
                    <p>Hệ thống sẽ tự động khớp ID (ví dụ [RG_01]) để điền trạng thái Pass/Fail vào bảng.</p>
                    <br/>
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{padding: '20px', border: '2px dashed #ccc', borderRadius: '8px'}}
                    />
                </div>
            )}

            {activeTab === "JSON" && (
              <pre style={styles.codeBlock}>
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.loading}>
          Đang xây dựng chiến lược test theo Module...<br/>
          Đang viết kịch bản Playwright e2e.spec.ts...<br/>
          <small>Sử dụng Gemini 3.0 Pro + Google Search Grounding</small>
        </div>
      )}
      
      {!loading && !data && !error && (
        <div style={styles.loading}>
          Nhập URL trang web phim phía trên để bắt đầu quy trình QA Automation.
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);