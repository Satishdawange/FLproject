/**
 * Google Apps Script backend code for Satish Servicenow Support Time & Billing Management
 * This code is copied by the user into Extensions > Apps Script in their Google Sheet.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * SATISH SERVICENOW SUPPORT - GOOGLE APPS SCRIPT BACKEND
 * =========================================================================
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs and replace with this entire code.
 * 4. Click 'Save' (floppy disk icon).
 * 5. Run 'initSheet()' once from the run bar to create the 'Users' tab.
 * 6. Click 'Deploy' > 'New deployment' > Select type: 'Web app'.
 * 7. Set:
 *    - Description: "Satish Servicenow Support API"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone"
 * 8. Click 'Deploy', authorize the permissions, and copy the Web App URL.
 * 9. Paste the Web App URL into your Satish Servicenow Support settings.
 * =========================================================================
 */

function doGet(e) {
  return handleRequest(e ? e.parameter : {});
}

function doPost(e) {
  var params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = e.parameter || {};
    }
  } else if (e && e.parameter) {
    params = e.parameter;
  }
  return handleRequest(params);
}

function handleRequest(params) {
  var action = params.action || 'ping';
  var output = { success: false, message: 'Invalid request' };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping' || action === 'test') {
      output = {
        success: true,
        message: 'Google Sheets connected successfully!',
        sheetName: ss.getName(),
        sheets: ss.getSheets().map(function(s) { return s.getName(); })
      };
    } else if (action === 'debug') {
      output = {
        success: true,
        sheetName: ss.getName(),
        sheets: ss.getSheets().map(function(s) {
          var vals = s.getDataRange().getValues();
          return {
            name: s.getName(),
            rows: vals.length,
            header: vals.length > 0 ? vals[0] : []
          };
        })
      };
    } else if (action === 'login') {
      output = handleLogin(ss, params.username, params.password);
    } else if (action === 'getEntries') {
      output = handleGetEntries(ss, params.month);
    } else if (action === 'addEntry') {
      output = handleAddEntry(ss, params);
    } else if (action === 'init') {
      initSheet();
      output = { success: true, message: 'Initialized sheet structure.' };
    }
  } catch (error) {
    output = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initializes the sheet with Users tab and default accounts if missing
 */
function initSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('Users');
  if (!userSheet) {
    userSheet = ss.insertSheet('Users', 0);
    userSheet.appendRow(['Username', 'Password', 'Role', 'Full Name', 'Created At']);
    
    // Style header row
    var headerRange = userSheet.getRange(1, 1, 1, 5);
    headerRange.setBackground('#0f6b61');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    userSheet.setFrozenRows(1);
    
    // Add default accounts
    userSheet.appendRow(['admin', 'admin123', 'admin', 'Administrator', new Date().toISOString()]);
    userSheet.appendRow(['viewer', 'view123', 'read', 'Client Viewer', new Date().toISOString()]);
  }
}

/**
 * Validates user credentials against the 'Users' tab
 */
function handleLogin(ss, username, password) {
  initSheet();
  var userSheet = ss.getSheetByName('Users');
  var data = userSheet.getDataRange().getValues();

  var cleanUser = String(username || '').trim().toLowerCase();
  var cleanPass = String(password || '').trim();

  for (var i = 1; i < data.length; i++) {
    var u = String(data[i][0]).trim().toLowerCase();
    var p = String(data[i][1]).trim();
    var role = String(data[i][2] || 'read').trim().toLowerCase();
    var name = String(data[i][3] || data[i][0]).trim();

    if (u === cleanUser && p === cleanPass) {
      return {
        success: true,
        user: {
          username: data[i][0],
          name: name,
          role: role === 'admin' ? 'admin' : 'read'
        }
      };
    }
  }

  return { success: false, message: 'Invalid username or password' };
}

/**
 * Helper to ensure a monthly tab exists (e.g. "2026-10")
 * Auto creates with styled headers if not existing.
 */
function getOrCreateMonthSheet(ss, monthKey) {
  var sheet = ss.getSheetByName(monthKey);
  if (!sheet) {
    sheet = ss.insertSheet(monthKey);
    var headers = [
      'ID',
      'Date',
      'Start Time',
      'End Time',
      'Total Time',
      'Total Minutes',
      'Discount (Mins)',
      'Effective Time',
      'Effective Minutes',
      'Rate (₹/hr)',
      'Client',
      'Project',
      'Description',
      'Gross Money (₹)',
      'Discount Money (₹)',
      'Net Final Money (₹)',
      'Created At'
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f6b61');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Format numeric columns
    sheet.getRange("J:J").setNumberFormat("₹#,##0.00");
    sheet.getRange("N:P").setNumberFormat("₹#,##0.00");
  }
  return sheet;
}

/**
 * Adds an entry to the sheet, auto-creating month tab if needed
 */
function handleAddEntry(ss, data) {
  var dateStr = String(data.date || new Date().toISOString().slice(0, 10));
  var monthKey = dateStr.slice(0, 7); // "YYYY-MM"
  
  var sheet = getOrCreateMonthSheet(ss, monthKey);

  var totalMin = Number(data.totalMinutes || 0);
  var discountMin = Number(data.discountMinutes || 0);
  var effectiveMin = Math.max(0, totalMin - discountMin);
  var rate = Number(data.rate || 0);

  var grossMoney = (totalMin / 60) * rate;
  var netMoney = (effectiveMin / 60) * rate;
  var discountMoney = grossMoney - netMoney;

  function fmtTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
  }

  var row = [
    data.id || String(new Date().getTime()),
    dateStr,
    data.startTime || '',
    data.endTime || '',
    fmtTime(totalMin),
    totalMin,
    discountMin,
    fmtTime(effectiveMin),
    effectiveMin,
    rate,
    data.client || '',
    data.project || '',
    data.description || '',
    Math.round(grossMoney),
    Math.round(discountMoney),
    Math.round(netMoney),
    new Date().toISOString()
  ];

  sheet.appendRow(row);

  return {
    success: true,
    message: 'Entry successfully added to sheet tab ' + monthKey,
    tab: monthKey
  };
}

/**
 * Fetches all session entries from sheets (supports YYYY-MM tabs, Sheet1, and custom tabs)
 */
function handleGetEntries(ss, targetMonth) {
  var sheets = ss.getSheets();
  var entries = [];

  function parseDateValue(rawDate) {
    if (!rawDate && rawDate !== 0) return '';
    if ((rawDate instanceof Date) || (rawDate && typeof rawDate.getTime === 'function')) {
      var yr = rawDate.getFullYear();
      var mo = String(rawDate.getMonth() + 1);
      if (mo.length < 2) mo = '0' + mo;
      var da = String(rawDate.getDate());
      if (da.length < 2) da = '0' + da;
      return yr + '-' + mo + '-' + da;
    }
    var str = String(rawDate).trim();
    var ymd = str.match(/^([0-9]{4})[/-]([0-9]{1,2})[/-]([0-9]{1,2})/);
    if (ymd) {
      var m = ymd[2].length < 2 ? '0' + ymd[2] : ymd[2];
      var d = ymd[3].length < 2 ? '0' + ymd[3] : ymd[3];
      return ymd[1] + '-' + m + '-' + d;
    }
    var dmy = str.match(/^([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4})/);
    if (dmy) {
      var dm = dmy[2].length < 2 ? '0' + dmy[2] : dmy[2];
      var dd = dmy[1].length < 2 ? '0' + dmy[1] : dmy[1];
      return dmy[3] + '-' + dm + '-' + dd;
    }
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      var pyr = parsed.getFullYear();
      var pmo = String(parsed.getMonth() + 1);
      if (pmo.length < 2) pmo = '0' + pmo;
      var pda = String(parsed.getDate());
      if (pda.length < 2) pda = '0' + pda;
      return pyr + '-' + pmo + '-' + pda;
    }
    return str.slice(0, 10);
  }

  function parseTimeValue(rawTime) {
    if (!rawTime && rawTime !== 0) return '';
    if ((rawTime instanceof Date) || (rawTime && typeof rawTime.getTime === 'function')) {
      var hrs = String(rawTime.getHours());
      var mins = String(rawTime.getMinutes());
      if (hrs.length < 2) hrs = '0' + hrs;
      if (mins.length < 2) mins = '0' + mins;
      return hrs + ':' + mins;
    }
    var str = String(rawTime).trim();
    var match = str.match(/([0-9]{1,2}):([0-9]{2})/);
    if (match) {
      var h = match[1].length < 2 ? '0' + match[1] : match[1];
      return h + ':' + match[2];
    }
    return str;
  }

  function parseNumValue(val, fallback) {
    if (typeof val === 'number') return isNaN(val) ? (fallback || 0) : val;
    if (!val && val !== 0) return fallback || 0;
    var clean = String(val).replace(/[^0-9.-]/g, '');
    var n = parseFloat(clean);
    return isNaN(n) ? (fallback || 0) : n;
  }

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var name = sheet.getName().trim();

    // Skip internal metadata tab
    if (name.toLowerCase() === 'users') continue;

    // If targetMonth is provided and this is a month tab for a different month, skip
    var isMonthPattern = /^[0-9]{4}-[0-9]{1,2}$/.test(name);
    if (targetMonth && isMonthPattern && name !== targetMonth) continue;

    var values = sheet.getDataRange().getValues();
    if (!values || values.length <= 1) continue;

    // Detect column indexes dynamically from the header row
    var headers = values[0].map(function(h) {
      return String(h || '').trim().toLowerCase();
    });

    function findCol(keywords, fallback) {
      for (var i = 0; i < headers.length; i++) {
        for (var k = 0; k < keywords.length; k++) {
          if (headers[i].indexOf(keywords[k]) !== -1) return i;
        }
      }
      return fallback;
    }

    // Determine column indices
    var dateCol = findCol(['date'], -1);
    var idCol = findCol(['session id', 'entry id'], -1);
    if (idCol === -1 && headers[0] === 'id') idCol = 0;

    // If no date header, deduce from position
    if (dateCol === -1) {
      dateCol = (idCol === 0) ? 1 : 0;
    }

    var startCol = findCol(['start time', 'start'], 2);
    var endCol = findCol(['end time', 'end'], 3);
    var totalMinCol = findCol(['total min', 'total minutes'], 5);
    var discMinCol = findCol(['discount in time', 'discount (min', 'discount min', 'discount'], 6);
    var effMinCol = findCol(['effective min', 'effective minutes'], 8);
    var rateCol = findCol(['rate'], 9);
    var clientCol = findCol(['client'], 10);
    var projCol = findCol(['project'], 11);
    var descCol = findCol(['description', 'desc', 'work'], 12);
    var grossCol = findCol(['gross money', 'gross'], 13);
    var discMoneyCol = findCol(['discount money', 'discount in money'], 14);
    var netCol = findCol(['net final money', 'net money', 'final money', 'net'], 15);
    var createdCol = findCol(['created at', 'created'], 16);

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var rawDate = row[dateCol];
      if (rawDate === undefined || rawDate === null || rawDate === '') continue; // Skip empty row

      var dateStr = parseDateValue(rawDate);
      if (!dateStr || dateStr.length < 8) continue;
      if (targetMonth && dateStr.indexOf(targetMonth) !== 0) continue;

      var sTime = parseTimeValue(startCol >= 0 ? row[startCol] : '');
      var eTime = parseTimeValue(endCol >= 0 ? row[endCol] : '');

      var totalMin = parseNumValue(totalMinCol >= 0 ? row[totalMinCol] : 0, 0);
      // Auto-compute total minutes from start and end time if missing
      if (totalMin <= 0 && sTime && eTime) {
        var sP = sTime.split(':');
        var eP = eTime.split(':');
        if (sP.length >= 2 && eP.length >= 2) {
          var sMins = parseInt(sP[0], 10) * 60 + parseInt(sP[1], 10);
          var eMins = parseInt(eP[0], 10) * 60 + parseInt(eP[1], 10);
          if (eMins >= sMins) totalMin = eMins - sMins;
        }
      }

      var discMin = parseNumValue(discMinCol >= 0 ? row[discMinCol] : 0, 0);
      var effMin = (effMinCol >= 0 && row[effMinCol] !== '' && row[effMinCol] !== null) ? parseNumValue(row[effMinCol], 0) : Math.max(0, totalMin - discMin);
      var rateVal = parseNumValue(rateCol >= 0 ? row[rateCol] : 0, 0);

      var gross = (grossCol >= 0 && row[grossCol] !== '' && row[grossCol] !== null) ? parseNumValue(row[grossCol], 0) : (totalMin / 60) * rateVal;
      var net = (netCol >= 0 && row[netCol] !== '' && row[netCol] !== null) ? parseNumValue(row[netCol], 0) : (effMin / 60) * rateVal;
      var discM = (discMoneyCol >= 0 && row[discMoneyCol] !== '' && row[discMoneyCol] !== null) ? parseNumValue(row[discMoneyCol], 0) : Math.max(0, gross - net);

      var entryId = (idCol >= 0 && row[idCol]) ? String(row[idCol]) : (name + '-' + r);

      entries.push({
        id: entryId,
        date: dateStr,
        startTime: sTime,
        endTime: eTime,
        totalMinutes: totalMin,
        discountMinutes: discMin,
        effectiveMinutes: effMin,
        rate: rateVal,
        client: String((clientCol >= 0 && row[clientCol]) || ''),
        project: String((projCol >= 0 && row[projCol]) || ''),
        description: String((descCol >= 0 && row[descCol]) || ''),
        moneyWithoutDiscount: Math.round(gross),
        discountMoney: Math.round(discM),
        moneyWithDiscount: Math.round(net),
        createdAt: String((createdCol >= 0 && row[createdCol]) || '')
      });
    }
  }

  // Sort newest date first
  entries.sort(function(a, b) {
    if (b.date === a.date) {
      return (b.startTime || '').localeCompare(a.startTime || '');
    }
    return b.date.localeCompare(a.date);
  });

  return {
    success: true,
    sheetName: ss.getName(),
    sheets: sheets.map(function(s) { return s.getName(); }),
    entries: entries,
    count: entries.length
  };
}
`
