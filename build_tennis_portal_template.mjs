import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, ".xlsx-build-tennis-template");
const outputDir = path.join(root, "outputs", "01a004ef-b04b-7e21-b8a0-6ceca4eac598");
await fs.rm(buildDir, { recursive: true, force: true });
await fs.mkdir(path.join(buildDir, "_rels"), { recursive: true });
await fs.mkdir(path.join(buildDir, "docProps"), { recursive: true });
await fs.mkdir(path.join(buildDir, "xl", "_rels"), { recursive: true });
await fs.mkdir(path.join(buildDir, "xl", "worksheets", "_rels"), { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const colName = (n) => { let s = ""; while (n) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
const ref = (r, c) => `${colName(c)}${r}`;
const cell = (r, c, value, style = 0, type = "s") => {
  const a = ref(r, c);
  if (value === null || value === undefined || value === "") return `<c r="${a}" s="${style}"/>`;
  if (type === "f") return `<c r="${a}" s="${style}"><f>${esc(value)}</f><v></v></c>`;
  if (type === "n") return `<c r="${a}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${a}" s="${style}" t="inlineStr"><is><t${String(value).includes("\n") ? ' xml:space="preserve"' : ""}>${esc(value)}</t></is></c>`;
};
const row = (r, cells, attrs = "") => `<row r="${r}" ${attrs}>${cells.join("")}</row>`;
const sheetXml = ({ rows, cols = "", merges = [], validations = "", autofilter = "", freeze = "", selected = false, tabColor = "" }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>${tabColor ? `<tabColor rgb="${tabColor}"/>` : ""}</sheetPr>
  <sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ""} showGridLines="0">${freeze}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  ${cols}
  <sheetData>${rows.join("")}</sheetData>
  ${autofilter}
  ${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}
  ${validations}
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
const cols = (specs) => `<cols>${specs.map(([min,max,width,hidden]) => `<col min="${min}" max="${max}" width="${width}" customWidth="1"${hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>`;
const freeze = (ySplit, topLeft) => `<pane ySplit="${ySplit}" topLeftCell="${topLeft}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${topLeft}" sqref="${topLeft}"/>`;
const dv = (sqref, formula) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" sqref="${sqref}"><formula1>${esc(formula)}</formula1></dataValidation>`;
const serial = (iso) => Math.floor((Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899,11,30)) / 86400000);

const sheets = [];

// Club Setup
{
  const rows = [];
  rows.push(row(1, [cell(1,1,"Tennis Club Portal Workbook",1), cell(1,2,"",1), cell(1,3,"",1), cell(1,4,"",1)]));
  rows.push(row(2, [cell(2,1,"Enter your club and season details, then list up to 14 teams. Blue cells are for input; grey cells are portal outputs.",2), cell(2,2,"",2), cell(2,3,"",2), cell(2,4,"",2)], 'ht="34" customHeight="1"'));
  const setup = [
    [4,"Club name","Example Tennis Club","Used for reference; team names should be entered in full below."],
    [5,"Portal team prefix","Example","Teams whose names begin with this text are treated as your club teams."],
    [6,"Season start",serial("2026-04-01"),"Portal importer currently accepts 1 April to 31 August 2026."],
    [7,"Season end",serial("2026-08-31"),"Change only if the portal importer season window is updated."],
  ];
  for (const [r,label,val,note] of setup) rows.push(row(r,[cell(r,1,label,3),cell(r,2,val, r>=6 ? 7 : 4, r>=6 ? "n":"s"),cell(r,3,note,8),cell(r,4,"",8)]));
  rows.push(row(10,[cell(10,1,"Team name",3),cell(10,2,"Planned matches",3),cell(10,3,"Active?",3),cell(10,4,"Notes",3)]));
  for(let r=11;r<=24;r++) rows.push(row(r,[cell(r,1,"",4),cell(r,2,"",5),cell(r,3,"Yes",4),cell(r,4,"",4)]));
  const validations = `<dataValidations count="1">${dv("C11:C24",'"Yes,No"')}</dataValidations>`;
  sheets.push({name:"Club Setup", xml:sheetXml({rows,cols:cols([[1,1,27],[2,2,18],[3,3,16],[4,4,48]]),merges:["A1:D1","A2:D2","C4:D4","C5:D5","C6:D6","C7:D7"],validations,freeze:freeze(10,"A11"),selected:true,tabColor:"FF1F4E78"})});
}

// Fixtures Input
{
  const rows=[];
  rows.push(row(1,[cell(1,1,"Fixtures Input",1),...Array.from({length:6},(_,i)=>cell(1,i+2,"",1))]));
  rows.push(row(2,[cell(2,1,"Enter one fixture per row. Day is calculated automatically. Maximum 92 fixtures matches the portal's By Date rows 2–93.",2),...Array.from({length:6},(_,i)=>cell(2,i+2,"",2))], 'ht="32" customHeight="1"'));
  ["Date","Day (auto)","Time","Home team","Away team","H / A","Status"].forEach((h,i)=>{});
  rows.push(row(4,["Date","Day (auto)","Time","Home team","Away team","H / A","Status"].map((h,i)=>cell(4,i+1,h,3))));
  for(let r=5;r<=96;r++) rows.push(row(r,[cell(r,1,"",7),cell(r,2,`IF(A${r}="","",TEXT(A${r},"ddd"))`,6,"f"),cell(r,3,"",9),cell(r,4,"",4),cell(r,5,"",4),cell(r,6,"",4),cell(r,7,"",4)]));
  const validations=`<dataValidations count="2">${dv("F5:F96",'"H,A"')}${dv("G5:G96",'"To Do,Booked,Offer,Rain Date,In Progress,Rebook,TBC,Played,Cancelled"')}</dataValidations>`;
  sheets.push({name:"Fixtures Input",xml:sheetXml({rows,cols:cols([[1,1,14],[2,2,14],[3,3,12],[4,5,28],[6,6,11],[7,7,18]]),merges:["A1:G1","A2:G2"],validations,autofilter:'<autoFilter ref="A4:G96"/>',freeze:freeze(4,"A5"),tabColor:"FF2E75B6"})});
}

// Results Input
{
  const rows=[];
  rows.push(row(1,[cell(1,1,"Results Input",1),...Array.from({length:6},(_,i)=>cell(1,i+2,"",1))]));
  rows.push(row(2,[cell(2,1,"Enter one row for each club-team match. Set Played and Won to Yes/No; Net Points drives the portal average rankings.",2),...Array.from({length:6},(_,i)=>cell(2,i+2,"",2))], 'ht="32" customHeight="1"'));
  rows.push(row(4,["Date","Club team","Opponent","H / A","Played?","Won?","Net points"].map((h,i)=>cell(4,i+1,h,3))));
  for(let r=5;r<=204;r++) rows.push(row(r,[cell(r,1,"",7),cell(r,2,"",4),cell(r,3,"",4),cell(r,4,"",4),cell(r,5,"",4),cell(r,6,"",4),cell(r,7,"",10)]));
  const validations=`<dataValidations count="3">${dv("D5:D204",'"H,A"')}${dv("E5:E204",'"Yes,No"')}${dv("F5:F204",'"Yes,No"')}</dataValidations>`;
  sheets.push({name:"Results Input",xml:sheetXml({rows,cols:cols([[1,1,14],[2,3,28],[4,6,12],[7,7,14]]),merges:["A1:G1","A2:G2"],validations,autofilter:'<autoFilter ref="A4:G204"/>',freeze:freeze(4,"A5"),tabColor:"FF2E75B6"})});
}

// Portal Updates
{
  const rows=[];
  rows.push(row(1,[cell(1,1,"Portal Updates",1),cell(1,2,"",1),cell(1,3,"",1),cell(1,4,"",1)]));
  rows.push(row(2,[cell(2,1,"Type the recent portal feature notes below. Line breaks are supported; the text is copied automatically to Portal Features!A1.",2),cell(2,2,"",2),cell(2,3,"",2),cell(2,4,"",2)], 'ht="34" customHeight="1"'));
  rows.push(row(4,[cell(4,1,"Recent features in the past week",3),cell(4,2,"",3),cell(4,3,"",3),cell(4,4,"",3)]));
  rows.push(row(5,[cell(5,1,"",11),cell(5,2,"",11),cell(5,3,"",11),cell(5,4,"",11)], 'ht="150" customHeight="1"'));
  rows.push(row(7,[cell(7,1,"Tip",3),cell(7,2,"Use Alt+Enter (Windows) or Control+Option+Return (Mac) for a line break in the cell.",8),cell(7,3,"",8),cell(7,4,"",8)]));
  sheets.push({name:"Portal Updates",xml:sheetXml({rows,cols:cols([[1,1,24],[2,4,22]]),merges:["A1:D1","A2:D2","A4:D4","A5:D5","B7:D7"],tabColor:"FF70AD47"})});
}

// By Date portal-facing mapped sheet
{
  const rows=[];
  rows.push(row(1,[cell(1,2,"Portal mapping — do not rename or rearrange",12),cell(1,3,"Date",3),cell(1,4,"Day",3),cell(1,6,"Time",3),cell(1,7,"Home Team",3),cell(1,8,"Away Team",3),cell(1,9,"Venue",3),cell(1,12,"Status",3)]));
  for(let r=2;r<=93;r++) { const src=r+3; rows.push(row(r,[cell(r,3,`IF('Fixtures Input'!A${src}="","",'Fixtures Input'!A${src})`,13,"f"),cell(r,4,`IF(C${r}="","",TEXT(C${r},"ddd"))`,6,"f"),cell(r,6,`IF('Fixtures Input'!C${src}="","",'Fixtures Input'!C${src})`,14,"f"),cell(r,7,`IF('Fixtures Input'!D${src}="","",'Fixtures Input'!D${src})`,12,"f"),cell(r,8,`IF('Fixtures Input'!E${src}="","",'Fixtures Input'!E${src})`,12,"f"),cell(r,9,`IF('Fixtures Input'!F${src}="","",'Fixtures Input'!F${src})`,12,"f"),cell(r,12,`IF('Fixtures Input'!A${src}="","",IF('Fixtures Input'!G${src}="","Published",'Fixtures Input'!G${src}))`,12,"f")])); }
  rows.push(row(106,[cell(106,2,"Monthly portal totals",1),cell(106,3,"",1),cell(106,4,"",1),cell(106,5,"",1),cell(106,6,"",1),cell(106,7,"",1),cell(106,8,"",1)]));
  rows.push(row(107,[cell(107,2,"Month",3),cell(107,3,"Originally Planned",3),cell(107,5,"Played",3),cell(107,8,"Currently Planned",3)]));
  const months=["April","May","June","July","August"];
  for(let i=0;i<5;i++){ const r=108+i, m=i+4; rows.push(row(r,[cell(r,2,months[i],12),cell(r,3,`COUNTIFS('Fixtures Input'!$A$5:$A$96,">="&DATE(YEAR('Club Setup'!$B$6),${m},1),'Fixtures Input'!$A$5:$A$96,"<"&EDATE(DATE(YEAR('Club Setup'!$B$6),${m},1),1))`,15,"f"),cell(r,5,`COUNTIFS('Results Input'!$A$5:$A$204,">="&DATE(YEAR('Club Setup'!$B$6),${m},1),'Results Input'!$A$5:$A$204,"<"&EDATE(DATE(YEAR('Club Setup'!$B$6),${m},1),1),'Results Input'!$E$5:$E$204,"Yes")`,15,"f"),cell(r,8,`COUNTIFS('Fixtures Input'!$A$5:$A$96,">="&DATE(YEAR('Club Setup'!$B$6),${m},1),'Fixtures Input'!$A$5:$A$96,"<"&EDATE(DATE(YEAR('Club Setup'!$B$6),${m},1),1),'Fixtures Input'!$G$5:$G$96,"<>Cancelled")`,15,"f")])); }
  sheets.push({name:"By Date",xml:sheetXml({rows,cols:cols([[1,1,3],[2,2,23],[3,3,13],[4,4,11],[5,5,3],[6,6,11],[7,8,27],[9,9,11],[10,11,3],[12,12,18]]),merges:["B106:H106"],freeze:freeze(1,"C2"),tabColor:"FFA5A5A5"})});
}

// League Results portal-facing mapped sheet
{
  const rows=[];
  rows.push(row(1,[cell(1,11,"League Results — portal mapping",1),...Array.from({length:18},(_,i)=>cell(1,i+12,"",1))]));
  rows.push(row(5,[cell(5,11,"Team",3),cell(5,19,"Remaining",3),cell(5,20,"Played",3),cell(5,26,"Avg Net Points",3),cell(5,29,"% Played",3)]));
  for(let r=7;r<=20;r++){ const setup=r+4; rows.push(row(r,[cell(r,11,`IF('Club Setup'!A${setup}="","",'Club Setup'!A${setup})`,12,"f"),cell(r,19,`IF(K${r}="","",MAX(0,IFERROR(INDEX('Club Setup'!$B$11:$B$24,MATCH(K${r},'Club Setup'!$A$11:$A$24,0)),0)-T${r}))`,15,"f"),cell(r,20,`IF(K${r}="","",COUNTIFS('Results Input'!$B$5:$B$204,K${r},'Results Input'!$E$5:$E$204,"Yes"))`,15,"f"),cell(r,26,`IF(K${r}="","",IFERROR(AVERAGEIFS('Results Input'!$G$5:$G$204,'Results Input'!$B$5:$B$204,K${r},'Results Input'!$E$5:$E$204,"Yes"),""))`,16,"f"),cell(r,29,`IF(K${r}="","",IFERROR(T${r}/(T${r}+S${r}),0))`,17,"f")])); }
  rows.push(row(21,[cell(21,11,"Portal summary totals",3),cell(21,20,`COUNTIF('Results Input'!$E$5:$E$204,"Yes")`,18,"f"),cell(21,21,`COUNTIFS('Results Input'!$E$5:$E$204,"Yes",'Results Input'!$F$5:$F$204,"Yes")`,18,"f")]));
  rows.push(row(22,[cell(22,20,"Total Matches Played",8),cell(22,21,"Total Wins",8)]));
  sheets.push({name:"League Results",xml:sheetXml({rows,cols:cols([[1,10,3],[11,11,28],[12,18,3],[19,20,15],[21,25,3],[26,26,18],[27,28,3],[29,29,14]]),merges:["K1:AC1"],freeze:freeze(5,"K6"),tabColor:"FFA5A5A5"})});
}

// Portal Features exact mapped cell
{
  const rows=[row(1,[cell(1,1,"IF('Portal Updates'!A5=\"\",\"\",'Portal Updates'!A5)",19,"f")], 'ht="180" customHeight="1"'),row(3,[cell(3,1,"Portal reads A1 only — update the blue input cell on Portal Updates.",8)])];
  sheets.push({name:"Portal Features",xml:sheetXml({rows,cols:cols([[1,1,80]]),tabColor:"FFA5A5A5"})});
}

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
 <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
 ${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
 <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl"/><workbookPr date1904="0"/><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="0.0"/><numFmt numFmtId="167" formatCode="0%"/></numFmts>
<fonts count="4"><font><sz val="10"/><color rgb="FF24364B"/><name val="Aptos"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><i/><sz val="10"/><color rgb="FF526170"/><name val="Aptos"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5B9BD5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="20">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="166" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="166" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="167" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Reusable Tennis Club Portal Workbook Template</dc:title><dc:creator>OpenAI Codex</dc:creator><dc:description>Input-led template mapped to the MTSC Fixtures Portal cells documented in SITE_DATA_SOURCES.md.</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">2026-08-15T00:00:00Z</dcterms:created></cp:coreProperties>`;
const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map(s=>`<vt:lpstr>${esc(s.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion></Properties>`;

await fs.writeFile(path.join(buildDir,"[Content_Types].xml"),contentTypes);
await fs.writeFile(path.join(buildDir,"_rels",".rels"),rels);
await fs.writeFile(path.join(buildDir,"xl","workbook.xml"),workbook);
await fs.writeFile(path.join(buildDir,"xl","_rels","workbook.xml.rels"),workbookRels);
await fs.writeFile(path.join(buildDir,"xl","styles.xml"),styles);
await fs.writeFile(path.join(buildDir,"docProps","core.xml"),core);
await fs.writeFile(path.join(buildDir,"docProps","app.xml"),app);
for(let i=0;i<sheets.length;i++) await fs.writeFile(path.join(buildDir,"xl","worksheets",`sheet${i+1}.xml`),sheets[i].xml);
console.log(path.join(outputDir,"Reusable_Tennis_Club_Portal_Template.xlsx"));
