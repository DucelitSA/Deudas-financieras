const functions = require("firebase-functions");
const https = require("https");

function fetchBCU(moneda) {
  return new Promise((resolve, reject) => {
    const url = `https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/wsbcucotizaciones?moneda=${moneda}&cant=1`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function parseTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>[\\s]*([\\d\\.,]+)[\\s]*<\\/${tag}>`));
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

exports.cotizaciones = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");
  res.set("Cache-Control", "public, max-age=1800");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const [xmlUSD, xmlUI, xmlEUR] = await Promise.all([
      fetchBCU("2222"),
      fetchBCU("9800"),
      fetchBCU("1111"),
    ]);

    res.status(200).json({
      usd: {
        compra: parseTag(xmlUSD, "COMPRA"),
        venta:  parseTag(xmlUSD, "VENTA"),
      },
      ui: {
        venta:       parseTag(xmlUI, "VENTA"),
        ventaManana: parseTag(xmlUI, "VENTAMANANA"),
      },
      eur: {
        venta: parseTag(xmlEUR, "VENTA"),
      },
      fecha: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching BCU:", error);
    res.status(500).json({ error: "No se pudo conectar con el BCU" });
  }
});