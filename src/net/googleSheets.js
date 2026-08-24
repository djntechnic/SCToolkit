/**
 * Google Sheets Integration Network Helper.
 *
 * Handles Google Sheet ID extraction and sanitation, payload formatting,
 * and POST requests to user-deployed Google Apps Script Web Apps.
 */

import { Log } from "../core/log.js";

/**
 * Extract and sanitize a clean 44+ character Google Sheet ID from any format
 * (e.g. raw ID, leading slash path, or full spreadsheet URL).
 *
 * Examples:
 * - "/1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI" -> "1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI"
 * - "https://docs.google.com/spreadsheets/d/1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI/edit#gid=0" -> "1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI"
 * - "1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI" -> "1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI"
 *
 * @param {string} inputStr
 * @returns {string} Clean Google Sheet ID or empty string if invalid
 */
export function sanitizeSheetId(inputStr) {
  if (!inputStr || typeof inputStr !== "string") return "";

  const trimmed = inputStr.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return "";

  // Pattern 1: URL path matching /d/([a-zA-Z0-9_-]{25,})
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{25,})/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Pattern 2: Leading slash or standalone Sheet ID alphanumeric string
  const cleanMatch = trimmed.match(/^(?:\/)?([a-zA-Z0-9_-]{25,})(?:\/|\?|#|$)/);
  if (cleanMatch && cleanMatch[1]) {
    return cleanMatch[1];
  }

  return trimmed.replace(/^\//, "");
}

/**
 * Send TSV values to a deployed Google Apps Script Web App.
 *
 * @param {Object} params
 * @param {string} params.sheetId - Google Sheet ID
 * @param {string} params.worksheet - Target worksheet/tab name
 * @param {string} params.tsvLine - Tab-separated line of values
 * @param {string} params.webAppUrl - Deployed Google Apps Script Web App URL
 * @returns {Promise<{success: boolean, message: string, row?: number, colLetter?: string, cellRef?: string, sheetUrl?: string}>}
 */
export async function sendToGoogleSheet({ sheetId, worksheet, tsvLine, webAppUrl }) {
  const cleanSheetId = sanitizeSheetId(sheetId);
  const targetWorksheet = (worksheet || "Singles & Lots").trim();
  const endpoint = (webAppUrl || "").trim();

  if (!cleanSheetId) {
    const err = "Google Sheet ID is not configured or is invalid.";
    Log(err, "error", "client");
    return { success: false, message: err };
  }

  if (!endpoint) {
    const err = "Google Apps Script Web App URL is not configured.";
    Log(err, "error", "client");
    return { success: false, message: err };
  }

  if (!tsvLine) {
    const err = "No TSV data provided to send.";
    Log(err, "error", "client");
    return { success: false, message: err };
  }

  const values = tsvLine.split("\t");
  if (values.length === 8) {
    values.push("1");
  }
  const payload = {
    sheetId: cleanSheetId,
    worksheet: targetWorksheet,
    values: values,
    rawTsv: tsvLine,
    targetCol: 9, // Explicitly target column I (column 9)
  };

  Log(
    `Sending row (${values.length} fields) to Google Sheet '${cleanSheetId}' worksheet '${targetWorksheet}' via Web App...`,
    "info",
    "network",
  );

  try {
    // text/plain avoids CORS preflight OPTIONS request issues in Google Apps Script Web Apps
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = `HTTP ${response.status} ${response.statusText} from Google Apps Script Web App.`;
      Log(err, "error", "network");
      return { success: false, message: err };
    }

    const resData = await response.json();
    if (resData.status === "success") {
      const row = resData.row;
      const colLetter = resData.colLetter || "I";
      const cellRef = resData.cellRef || `${colLetter}${row}`;
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit#range=${cellRef}`;
      const sheetUrl = resData.sheetUrl || fallbackUrl;
      const msg = `Successfully pasted row into '${targetWorksheet}' at cell ${cellRef}`;
      Log(msg, "info", "network");
      return {
        success: true,
        message: msg,
        row: row,
        colLetter: colLetter,
        cellRef: cellRef,
        sheetUrl: sheetUrl,
      };
    } else {
      const err = resData.message || "Unknown error returned from Google Apps Script Web App.";
      Log(`Google Apps Script error: ${err}`, "error", "network");
      return { success: false, message: err };
    }
  } catch (error) {
    const err = `Failed to send row to Google Sheet: ${error.message}`;
    Log(err, "error", "network");
    return { success: false, message: err };
  }
}
