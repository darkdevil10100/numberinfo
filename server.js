const https = require("https");

// ── API endpoints ─────────────────────────────────────────────────────────────
const APIS = {
  number: {
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/number?num=${q}`,
    parse: (data) => {
      const records = Array.isArray(data.results) ? data.results : [];
      return { success: records.length > 0, records, total: records.length, extra: {} };
    }
  },
  number_astha: {
    build: (q) => `https://astha-9vd8.onrender.com/tapi-50ef9513ec867f25490777489b683c84?phone=${q}`,
    parse: (data) => {
      const records = data.data || [];
      return { success: records.length > 0, records, total: records.length, extra: {} };
    }
  },
  aadhar: {
    build: (q) => `https://xpolitesupgrade-api.darrify-api.workers.dev/api/aadhar-info?token=xpol_ghost_single_c34c5849&id=${q}`,
    parse: (data) => {
      let records = [];
      if (data.response && Array.isArray(data.response.data)) records = data.response.data;
      else if (Array.isArray(data.results)) records = data.results;
      else if (Array.isArray(data.data))    records = data.data;
      else if (Array.isArray(data.result))  records = data.result;
      else if (data.results && typeof data.results === "object") records = [data.results];
      else if (data.data    && typeof data.data    === "object") records = [data.data];
      // Deduplicate
      const seen = new Set();
      records = records.filter(r => {
        const key = r.num || r.aadhar || JSON.stringify(r);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      return { success: records.length > 0, records, total: records.length, extra: {} };
    }
  },
  vehicle: {
    build: (q) => `https://xpolitesupgrade-api.darrify-api.workers.dev/api/vehicle-pro?token=xpol_ghost_single_08824c22&rc=${q}`,
    parse: (data) => {
      let rec = data.result || data.data || data.vehicle;
      if (!rec || typeof rec !== "object") return { success: false, records: [], total: 0, extra: {} };
      const n = {};
      for (const [k, v] of Object.entries(rec)) n[k.toLowerCase().replace(/\s+/g, "_")] = v;
      const mapped = {
        ...n,
        owner_name:        n.owner_name        || n.registered_owner,
        reg_no:            n.reg_no            || n.registration_number || "",
        maker_desc:        n.maker_model       || n.model_name,
        model_desc:        n.model_name        || "",
        fuel_desc:         n.fuel_type         || "",
        mobile_no:         n.phone             || n.mobile_no          || "",
        insurance_company: n.insurance_company || "",
        insurance_upto:    n.insurance_upto    || "",
        pucc_upto:         n.puc_upto          || "",
        fc_upto:           n.fitness_upto      || "",
        tax_upto:          n.tax_upto          || "",
        emission_norm:     n.fuel_norms        || "",
        rto:               n.registered_rto    || "",
        reg_date:          n.registration_date || "",
      };
      return { success: true, records: [mapped], total: 1, extra: {} };
    }
  },
  pan: {
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/pan?num=${q}`,
    parse: (data) => {
      const records = data.data ? [data.data] : (data.results || []);
      return { success: records.length > 0, records, total: records.length, extra: {} };
    }
  },
  email: {
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/email?email=${q}`,
    parse: (data) => {
      const records = data.data ? [data.data] : (data.results || []);
      return { success: records.length > 0, records, total: records.length, extra: {} };
    }
  },
  name: {
    build: (q) => `https://free-api-anuragsingh.vercel.app/api/name?name=${encodeURIComponent(q)}`,
    parse: (data) => {
      const records = data.results || [];
      return { success: records.length > 0, records, total: records.length, extra: {} };
    }
  }
};

// ── Fetch upstream ────────────────────────────────────────────────────────────
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

// ── Vercel serverless handler ─────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const { type = "number", q = "", phone = "" } = req.query;
  const query = q || phone;

  if (!query) {
    res.status(400).json({ success: false, error: "Query required" });
    return;
  }

  const api = APIS[type];
  if (!api) {
    res.status(400).json({ success: false, error: "Unknown type: " + type });
    return;
  }

  try {
    const raw    = await fetchUpstream(api.build(query));
    const result = api.parse(raw);
    res.status(200).json({ ...result, _raw: raw });
  } catch (e) {
    res.status(502).json({ success: false, error: "Upstream failed: " + e.message });
  }
};
