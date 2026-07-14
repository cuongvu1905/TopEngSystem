# Design Specification: Database Draw.io Diagram Generator

This specification outlines the design and implementation details for programmatically generating a Draw.io Entity-Relationship Diagram (ERD) from the MySQL database schema file `Top_Sys.sql`.

## 1. Overview
The goal is to automatically extract database tables, columns, and foreign key relationships from `Top_Sys.sql` and produce a clean, beautifully organized, and formatted `.drawio` XML diagram file.

## 2. Table Classification & Coloring Scheme
To improve visual readability, the 18 database tables are categorized into 5 functional modules, each assigned a cohesive color scheme:

| Module | Colors (Fill / Border) | Tables |
| :--- | :--- | :--- |
| **HR & Organization** | `#DAE8FC` (Blue) / `#6C8EBF` | `Department`, `Position`, `User` |
| **Customers & Projects** | `#D5E8D4` (Green) / `#82B366` | `Customer`, `Project`, `ProjectMember`, `DailyReport` |
| **Tasks & Issues** | `#FFE6CC` (Orange) / `#D79B00` | `Task`, `Subtask`, `Issue`, `IssueComments`, `IssueHistory` |
| **Chat & Communication** | `#E1D5E7` (Purple) / `#9673A6` | `ChatRooms`, `ChatRoomMember`, `Messages`, `MessagesAttachment` |
| **System & Monitoring** | `#F5F5F5` (Grey) / `#CCCCCC` | `Notificyations`, `ActivityLogs` |

## 3. Spatial Layout & Grid Coordinates
To minimize line overlaps, tables are structured in a 5-column layout based on primary functional flow and dependencies (e.g., master tables on the left, transactional/associative tables in the middle, and detail/history/log tables on the right):

* **Column 1 (x=50)**: Lookups & Master Tables
  * `Department` (y=50)
  * `Position` (y=200)
  * `Customer` (y=350)
  * `ChatRoomMember` (y=500)
* **Column 2 (x=400)**: Users & Chat Containers
  * `User` (y=100)
  * `ChatRooms` (y=500)
  * `Messages` (y=800)
* **Column 3 (x=750)**: Projects & Chat Details
  * `Project` (y=100)
  * `ProjectMember` (y=400)
  * `DailyReport` (y=600)
  * `MessagesAttachment` (y=800)
* **Column 4 (x=1100)**: Tasks, Issues & Notifications
  * `Task` (y=100)
  * `Issue` (y=400)
  * `Notificyations` (y=800)
* **Column 5 (x=1450)**: Details, Comments, History & System Logs
  * `Subtask` (y=100)
  * `IssueComments` (y=350)
  * `IssueHistory` (y=600)
  * `ActivityLogs` (y=850)

## 4. Draw.io XML Schema Representation
The `.drawio` file is XML-based. The generator script will write a standard mxGraph structure:
* **Table Containment**: A swimlane (`swimlane;childLayout=stackLayout;...`) vertex represents the table.
* **Fields**: Standard text boxes are nested inside the swimlane, showing field names, types, and indicators (e.g., `id [PK]`, `user_id [FK]`).
* **Connectors (Edges)**: Orthogonal connector lines with Crow's foot arrow types:
  * `startArrow=ERone;` (One)
  * `endArrow=ERmany;` (Many)
  * `edgeStyle=orthogonalEdgeStyle;` (Orthogonal paths for clean corners)

## 5. Generator Implementation (Python Script)
A helper script `scratch/generate_drawio.py` will be created to:
1. Parse `Top_Sys.sql` regex-wise or using line splitting to extract `CREATE TABLE` structures and `CONSTRAINT ... FOREIGN KEY`.
2. Extract fields (name, type, constraints).
3. Generate the XML template.
4. Write it directly to `docs/database/database_design.drawio`.
