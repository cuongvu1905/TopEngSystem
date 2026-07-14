# Database Draw.io Diagram Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a beautiful, color-coded, grid-aligned Entity-Relationship Diagram (ERD) of the MySQL database schema in `Top_Sys.sql` and write it as a Draw.io `.drawio` file.

**Architecture:** A Python parser script will extract tables, column details (PK/FK status), and relationships from the SQL DDL, calculate coordinate offsets to group tables logically by department/feature, and output them to a clean mxGraph XML representation.

**Tech Stack:** Python 3 (standard libraries: `re`, `xml.etree.ElementTree`).

## Global Constraints
- Target output file: `docs/database/database_design.drawio`
- Do NOT perform any git commit or git push operations automatically. Ask for permission first.
- Colors must match the visual classification spec.
- Grid positions must follow the 5-column layout.

---

### Task 1: Create the Python Generation Script

**Files:**
- Create: `scratch/generate_drawio.py`

**Interfaces:**
- Consumes: `Top_Sys.sql` DDL file
- Produces: `scratch/generate_drawio.py` script that generates a `.drawio` XML file.

- [ ] **Step 1: Write the generator script**

Write the complete Python script `scratch/generate_drawio.py` to parse `Top_Sys.sql` and output the mxGraph XML structure.

```python
import os
import re
import xml.etree.ElementTree as ET
import xml.dom.minidocument as minidoc  # Used for pretty printing

# SQL parsing patterns
TABLE_RE = re.compile(r"CREATE TABLE\s+`?(\w+)`?\s*\((.*?)\)\s*ENGINE", re.DOTALL | re.IGNORECASE)
COLUMN_RE = re.compile(r"^\s*`?(\w+)`?\s+([\w\(\)]+)(.*?)(?:,|$)", re.MULTILINE | re.IGNORECASE)
FK_RE = re.compile(r"CONSTRAINT\s+`?(\w+)`?\s+FOREIGN KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?\s*\(`?(\w+)`?\)", re.IGNORECASE)

COLOR_PALETTE = {
    # HR & Org
    "Department": ("#DAE8FC", "#6C8EBF"),
    "Position": ("#DAE8FC", "#6C8EBF"),
    "User": ("#DAE8FC", "#6C8EBF"),
    # Customers & Projects
    "Customer": ("#D5E8D4", "#82B366"),
    "Project": ("#D5E8D4", "#82B366"),
    "ProjectMember": ("#D5E8D4", "#82B366"),
    "DailyReport": ("#D5E8D4", "#82B366"),
    # Tasks & Issues
    "Task": ("#FFE6CC", "#D79B00"),
    "Subtask": ("#FFE6CC", "#D79B00"),
    "Issue": ("#FFE6CC", "#D79B00"),
    "IssueComments": ("#FFE6CC", "#D79B00"),
    "IssueHistory": ("#FFE6CC", "#D79B00"),
    # Chat & Comm
    "ChatRooms": ("#E1D5E7", "#9673A6"),
    "ChatRoomMember": ("#E1D5E7", "#9673A6"),
    "Messages": ("#E1D5E7", "#9673A6"),
    "MessagesAttachment": ("#E1D5E7", "#9673A6"),
    # System
    "Notificyations": ("#F5F5F5", "#CCCCCC"),
    "ActivityLogs": ("#F5F5F5", "#CCCCCC"),
}

TABLE_COORDS = {
    "Department": (50, 50),
    "Position": (50, 200),
    "Customer": (50, 350),
    "ChatRoomMember": (50, 500),
    "User": (400, 100),
    "ChatRooms": (400, 500),
    "Messages": (400, 800),
    "Project": (750, 100),
    "ProjectMember": (750, 400),
    "DailyReport": (750, 600),
    "MessagesAttachment": (750, 800),
    "Task": (1100, 100),
    "Issue": (1100, 400),
    "Notificyations": (1100, 800),
    "Subtask": (1450, 100),
    "IssueComments": (1450, 350),
    "IssueHistory": (1450, 600),
    "ActivityLogs": (1450, 850),
}

def parse_sql(sql_content):
    tables = {}
    fks = []
    
    # Clean statements (remove comments)
    sql_clean = re.sub(r"--.*?\n", "", sql_content)
    sql_clean = re.sub(r"/\*.*?\*/", "", sql_clean, flags=re.DOTALL)
    
    for match in TABLE_RE.finditer(sql_clean):
        table_name = match.group(1)
        body = match.group(2)
        
        columns = []
        pks = set()
        
        # Primary keys check inside body
        pk_matches = re.findall(r"PRIMARY KEY\s*\((.*?)\)", body, re.IGNORECASE)
        for pk_m in pk_matches:
            for p in pk_m.split(","):
                pks.add(p.strip().replace("`", ""))
                
        # Parse foreign keys inside table definition
        for fk_match in FK_RE.finditer(body):
            fk_name, local_col, ref_table, ref_col = fk_match.groups()
            fks.append({
                "table": table_name,
                "local_col": local_col,
                "ref_table": ref_table,
                "ref_col": ref_col
            })
            
        # Parse columns
        for line in body.split("\n"):
            line = line.strip()
            if not line or line.upper().startswith(("PRIMARY KEY", "FOREIGN KEY", "UNIQUE", "KEY", "CONSTRAINT")):
                continue
            col_match = COLUMN_RE.match(line)
            if col_match:
                col_name = col_match.group(1)
                col_type = col_match.group(2)
                col_extra = col_match.group(3)
                
                is_pk = col_name in pks or "PRIMARY KEY" in col_extra.upper()
                columns.append({
                    "name": col_name,
                    "type": col_type,
                    "is_pk": is_pk
                })
        
        tables[table_name] = columns
        
    return tables, fks

def build_drawio(tables, fks, output_path):
    root_el = ET.Element("mxfile", host="Electron", modified="2026-07-14T04:00:00Z", version="22.1.2", type="device")
    diagram = ET.SubElement(root_el, "diagram", id="diagram_1", name="TopEngManager ERD")
    graph_model = ET.SubElement(diagram, "mxGraphModel", dx="1200", dy="1200", grid="1", gridSize="10", guides="1", tooltips="1", connect="1", arrows="1", fold="1", page="1", pageScale="1", pageWidth="1920", pageHeight="1200", math="0", shadow="0")
    root = ET.SubElement(graph_model, "root")
    
    # Layer 0 & 1
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")
    
    cell_id = 2
    table_cell_ids = {}
    field_ports = {} # Map (table, col): id
    
    # Draw Tables
    for table_name, columns in tables.items():
        t_x, t_y = TABLE_COORDS.get(table_name, (100, 100))
        fill_color, border_color = COLOR_PALETTE.get(table_name, ("#FFFFFF", "#000000"))
        
        table_width = 240
        header_height = 30
        row_height = 26
        total_height = header_height + (len(columns) * row_height)
        
        # Create Table Container
        t_style = f"swimlane;childLayout=stackLayout;horizontal=1;startSize={header_height};horizontalStack=0;rounded=1;fontSize=14;fontStyle=1;strokeWidth=2;fillColor={fill_color};strokeColor={border_color};"
        t_id = f"table_{table_name}"
        t_cell = ET.SubElement(root, "mxCell", id=t_id, value=table_name, style=t_style, vertex="1", parent="1")
        ET.SubElement(t_cell, "mxGeometry", x=str(t_x), y=str(t_y), width=str(table_width), height=str(total_height), as="geometry")
        
        table_cell_ids[table_name] = t_id
        
        # Add Columns
        curr_y = header_height
        for col in columns:
            col_name = col["name"]
            col_type = col["type"]
            is_pk = col["is_pk"]
            
            # Label
            label = f"{col_name} : {col_type}"
            if is_pk:
                label = f"🔑 {label} [PK]"
                
            # Check if FK
            is_fk = False
            for fk in fks:
                if fk["table"] == table_name and fk["local_col"] == col_name:
                    is_fk = True
                    break
            if is_fk:
                label = f"🔗 {label} [FK]"
                
            c_id = f"field_{table_name}_{col_name}"
            c_style = f"text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=8;overflow=hidden;portConstraint=eastwest;rotatable=0;points=[[0,0.5],[1,0.5]];fontSize=11;"
            c_cell = ET.SubElement(root, "mxCell", id=c_id, value=label, style=c_style, vertex="1", parent=t_id)
            ET.SubElement(c_cell, "mxGeometry", y=str(curr_y), width=str(table_width), height=str(row_height), as="geometry")
            
            field_ports[(table_name, col_name)] = c_id
            curr_y += row_height
            
    # Draw Foreign Key Relationships
    edge_idx = 1
    for fk in fks:
        src_table = fk["ref_table"]
        src_col = fk["ref_col"]
        tgt_table = fk["table"]
        tgt_col = fk["local_col"]
        
        src_port_id = field_ports.get((src_table, src_col))
        tgt_port_id = field_ports.get((tgt_table, tgt_col))
        
        if src_port_id and tgt_port_id:
            e_style = "edgeStyle=orthogonalEdgeStyle;fontSize=10;html=1;endArrow=ERmany;startArrow=ERone;exitX=1;exitY=0.5;entryX=0;entryY=0.5;rounded=1;strokeColor=#4C4C4C;strokeWidth=1.5;"
            e_id = f"edge_{edge_idx}"
            edge_idx += 1
            
            e_cell = ET.SubElement(root, "mxCell", id=e_id, value="", style=e_style, edge="1", parent="1", source=src_port_id, target=tgt_port_id)
            ET.SubElement(e_cell, "mxGeometry", relative="1", as="geometry")
            
    # Write Pretty XML
    xml_str = ET.tostring(root_el, encoding="utf-8")
    dom = minidoc.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent="  ")
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(pretty_xml)
    print(f"Sơ đồ đã được tạo thành công tại: {output_path}")

if __name__ == "__main__":
    sql_path = "Top_Sys.sql"
    output_path = "docs/database/database_design.drawio"
    
    if not os.path.exists(sql_path):
        print(f"Lỗi: Không tìm thấy file {sql_path}")
    else:
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_content = f.read()
        tables, fks = parse_sql(sql_content)
        build_drawio(tables, fks, output_path)
```

- [ ] **Step 2: Run tests to verify script runs correctly**

Create directory `scratch` if it doesn't exist, save the file, and then run it to verify it compiles.

---

### Task 2: Execute Generation and Verify Output

**Files:**
- Create: `docs/database/database_design.drawio`

**Interfaces:**
- Consumes: `scratch/generate_drawio.py`
- Produces: Visual ERD XML file at `docs/database/database_design.drawio`

- [ ] **Step 1: Execute the script**

Run the python script:
`python scratch/generate_drawio.py`

Expected output:
`Sơ đồ đã được tạo thành công tại: docs/database/database_design.drawio`

- [ ] **Step 2: Verify output file structure**

Check if `docs/database/database_design.drawio` exists and has valid XML formatting containing `<mxfile>` and all 18 tables.
