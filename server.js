const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

// ── API endpoints per type ────────────────────────────────────────────────────
const APIS = {
  number: {
    label: "Number Info",
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/number?num=${q}`,
    parse: (data) => ({
      success: data.success,
      records: data.results || [],
      total: data.total || 0,
      extra: data.truecaller_name ? { "Truecaller Name": data.truecaller_name } : {}
    })
  },
  // Old astha API (still works for some numbers)
  number_astha: {
    label: "Number Info (Alt)",
    build: (q) => `https://astha-9vd8.onrender.com/tapi-50ef9513ec867f25490777489b683c84?phone=${q}`,
    parse: (data) => ({
      success: data.success,
      records: data.data || [],
      total: data.total_found || 0,
      extra: {}
    })
  },
 vehicle: {
  label: "Vehicle Info ",
  build: (q) => `https://xpolitesupgrade-api.darrify-api.workers.dev/api/vehicle-pro?token=xpol_ghost_single_08824c22&rc=${q}`,
  parse: (data) => {
    let rec = data.result || data.data || data.vehicle;
    if (!rec || typeof rec !== "object") {
      return { success: false, records: [], total: 0, extra: {} };
    }
    const normalized = {};
    for (const [key, value] of Object.entries(rec)) {
      const newKey = key.toLowerCase().replace(/\s+/g, "_");
      normalized[newKey] = value;
    }
    const mapped = {
      ...normalized,
      owner_name: normalized.owner_name || normalized.registered_owner,
      reg_no: normalized.reg_no || normalized.registration_number || "",
      maker_desc: normalized.maker_model || normalized.model_name,
      model_desc: normalized.model_name || "",
      fuel_desc: normalized.fuel_type || "",
      address: normalized.address || "",
      mobile_no: normalized.phone || normalized.mobile_no || "",
      insurance_company: normalized.insurance_company || "",
      insurance_upto: normalized.insurance_upto || "",
      pucc_upto: normalized.puc_upto || "",
      fc_upto: normalized.fitness_upto || "",
      tax_upto: normalized.tax_upto || "",
      emission_norm: normalized.fuel_norms || "",
      rto: normalized.registered_rto || "",
      reg_date: normalized.registration_date || "",
    };
    return { success: true, records: [mapped], total: 1, extra: {} };
  }
},
aadhar: {
  label: "Aadhar Info ",
  build: (q) => `https://xpolitesupgrade-api.darrify-api.workers.dev/api/aadhar-info?token=xpol_ghost_single_c34c5849&id=${q}`,
  parse: (data) => {
    let records = [];
    
    // Extract data from response.data
    if (data.response && Array.isArray(data.response.data)) {
      records = data.response.data;
    } 
    else if (Array.isArray(data.results)) records = data.results;
    else if (Array.isArray(data.data))    records = data.data;
    else if (Array.isArray(data.result))  records = data.result;
    else if (data.results && typeof data.results === "object") records = [data.results];
    else if (data.data && typeof data.data === "object")       records = [data.data];

    // ✅ REMOVE DUPLICATES - Based on phone number (num field)
    const uniqueRecords = [];
    const seenNumbers = new Set();
    
    records.forEach(record => {
      const key = record.num || record.aadhar || JSON.stringify(record);
      if (!seenNumbers.has(key)) {
        seenNumbers.add(key);
        uniqueRecords.push(record);
      }
    });

    return {
      success: uniqueRecords.length > 0,
      records: uniqueRecords,  // Send only unique records
      total: uniqueRecords.length,
      extra: {}
    };
  }
},
  pan: {
    label: "PAN Info",
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/pan?num=${q}`,
    parse: (data) => ({
      success: data.success || !!data.data,
      records: data.data ? [data.data] : (data.results || []),
      total: data.data ? 1 : 0,
      extra: {}
    })
  },
  email: {
    label: "Email Lookup",
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/email?email=${q}`,
    parse: (data) => ({
      success: data.success || !!data.data,
      records: data.data ? [data.data] : (data.results || []),
      total: data.data ? 1 : 0,
      extra: {}
    })
  },
  name: {
    label: "Name Search",
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/name?name=${encodeURIComponent(q)}`,
    parse: (data) => ({
      success: data.success,
      records: data.results || [],
      total: data.total || 0,
      extra: {}
    })
  }
};

// ── Fetch from upstream ───────────────────────────────────────────────────────
function fetchUpstream(apiUrl) {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, (r) => {
      let body = "";
      r.on("data", c => body += c);
      r.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("Invalid JSON from upstream")); }
      });
    }).on("error", reject);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Serve HTML — osint-console.html first, fallback to index.html
  if (parsed.pathname === "/" || parsed.pathname === "/index.html" || parsed.pathname === "/osint-console.html") {
    const names = ["osint-console.html", "index.html"];
    let served = false;
    for (const name of names) {
      const filePath = path.join(__dirname, name);
      if (fs.existsSync(filePath)) {
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(500); res.end("Read error"); return; }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(data);
        });
        served = true;
        break;
      }
    }
    if (!served) { res.writeHead(404); res.end("No HTML found"); }
    return;
  }

  // /lookup?type=number&q=9876543210
  if (parsed.pathname === "/lookup") {
    const type = parsed.query.type || "number";
    const q    = parsed.query.q || parsed.query.phone || "";

    if (!q) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Query required" }));
      return;
    }

    const api = APIS[type];
    if (!api) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unknown type" }));
      return;
    }

    const apiUrl = api.build(q);
    console.log(`[${new Date().toLocaleTimeString()}] [${type}] ${apiUrl}`);

    try {
      const raw    = await fetchUpstream(apiUrl);
      // ── DEBUG: print full raw response to terminal ──
      console.log(`\n[RAW RESPONSE][${type}]:\n${JSON.stringify(raw, null, 2)}\n`);
      const parsedResult = api.parse(raw);
      console.log(`[PARSED][${type}]: records=${parsedResult.records?.length}, success=${parsedResult.success}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...parsedResult, _raw: raw }));
    } catch (e) {
      console.error("[Upstream error]", e.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Failed to reach upstream API: " + e.message }));
    }
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n✅ Server running at http://localhost:${PORT}\n`);
  console.log("Supported types: number, vehicle, aadhar, pan, email, name\n");
});
