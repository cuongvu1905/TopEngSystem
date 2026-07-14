import os
import re
import xml.etree.ElementTree as ET
import xml.dom.minidom as minidom  # Used for pretty printing

# SQL parsing patterns
TABLE_RE = re.compile(r"CREATE TABLE\s+`?(\w+)`?\s*\((.*?)\)\s*ENGINE", re.DOTALL | re.IGNORECASE)
COLUMN_RE = re.compile(r"^\s*`?(\w+)`?\s+([\w]+(?:\([\w\s,']+\))?)(.*?)(?:,|$)", re.MULTILINE | re.IGNORECASE)
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

COLUMN_GROUPS = [
    ["Department", "Position", "Customer", "ChatRoomMember"],
    ["User", "ChatRooms", "Messages"],
    ["Project", "ProjectMember", "DailyReport", "MessagesAttachment"],
    ["Task", "Issue", "Notificyations"],
    ["Subtask", "IssueComments", "IssueHistory", "ActivityLogs"]
]

def parse_sql(sql_content):
    tables = {}
    fks = []
    
    # Clean statements (remove comments)
    sql_clean = re.sub(r"--.*?$", "", sql_content, flags=re.MULTILINE)
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
            if not line:
                continue
            tokens = [t.strip("`' ") for t in line.split()]
            if tokens and tokens[0].upper() in ("PRIMARY", "FOREIGN", "UNIQUE", "KEY", "CONSTRAINT", "INDEX"):
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
    
    # Solve Y-coordinates dynamically to avoid overlaps
    table_coords = {}
    x_spacing = 350
    y_start = 50
    y_spacing = 60
    
    for col_idx, col_tables in enumerate(COLUMN_GROUPS):
        curr_y = y_start
        x_pos = 50 + col_idx * x_spacing
        for t_name in col_tables:
            table_coords[t_name] = (x_pos, curr_y)
            cols_count = len(tables.get(t_name, []))
            table_height = 30 + (cols_count * 26)
            curr_y += table_height + y_spacing

    table_cell_ids = {}
    field_ports = {} # Map (table, col): id
    
    # Draw Tables
    for table_name, columns in tables.items():
        t_x, t_y = table_coords.get(table_name, (100, 100))
        fill_color, border_color = COLOR_PALETTE.get(table_name, ("#FFFFFF", "#000000"))
        
        table_width = 240
        header_height = 30
        row_height = 26
        total_height = header_height + (len(columns) * row_height)
        
        # Create Table Container
        t_style = f"swimlane;childLayout=stackLayout;horizontal=1;startSize={header_height};horizontalStack=0;rounded=1;fontSize=14;fontStyle=1;strokeWidth=2;fillColor={fill_color};strokeColor={border_color};"
        t_id = f"table_{table_name}"
        t_cell = ET.SubElement(root, "mxCell", id=t_id, value=table_name, style=t_style, vertex="1", parent="1")
        ET.SubElement(t_cell, "mxGeometry", attrib={
            "x": str(t_x),
            "y": str(t_y),
            "width": str(table_width),
            "height": str(total_height),
            "as": "geometry"
        })
        
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
            ET.SubElement(c_cell, "mxGeometry", attrib={
                "y": str(curr_y),
                "width": str(table_width),
                "height": str(row_height),
                "as": "geometry"
            })
            
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
            src_x, _ = table_coords.get(src_table, (0, 0))
            tgt_x, _ = table_coords.get(tgt_table, (0, 0))
            
            # Determine connection sides based on relative X position of the tables
            if src_table == tgt_table:
                exit_x, entry_x = 1, 1  # Self-reference loops out and back on the right side
            elif src_x == tgt_x:
                exit_x, entry_x = 0, 0  # Same column loops on the left side
            elif src_x < tgt_x:
                exit_x, entry_x = 1, 0
            else:
                exit_x, entry_x = 0, 1
            
            e_style = f"edgeStyle=orthogonalEdgeStyle;fontSize=10;html=1;endArrow=ERmany;startArrow=ERone;exitX={exit_x};exitY=0.5;entryX={entry_x};entryY=0.5;rounded=1;strokeColor=#4C4C4C;strokeWidth=1.5;"
            e_id = f"edge_{edge_idx}"
            edge_idx += 1
            
            e_cell = ET.SubElement(root, "mxCell", id=e_id, value="", style=e_style, edge="1", parent="1", source=src_port_id, target=tgt_port_id)
            ET.SubElement(e_cell, "mxGeometry", relative="1", attrib={"as": "geometry"})
        else:
            missing_details = []
            if not src_port_id:
                missing_details.append(f"source {src_table}.{src_col}")
            if not tgt_port_id:
                missing_details.append(f"target {tgt_table}.{tgt_col}")
            print(f"Warning: Relationship skipped due to missing ports: {', '.join(missing_details)}")
            
    # Write Pretty XML
    xml_str = ET.tostring(root_el, encoding="utf-8")
    dom = minidom.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent="  ")
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(pretty_xml)
    print(f"ERD successfully generated at: {output_path}")

if __name__ == "__main__":
    sql_path = "Top_Sys.sql"
    output_path = "docs/database/database_design.drawio"
    
    if not os.path.exists(sql_path):
        print(f"Error: File not found {sql_path}")
    else:
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_content = f.read()
        tables, fks = parse_sql(sql_content)
        build_drawio(tables, fks, output_path)
