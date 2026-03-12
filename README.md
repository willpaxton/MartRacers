# MartRacers
Product Vision Statement: For shoppers who need a more entertaining shopping experience when they go to their favorite superstore. The MartRacers Web Application is a Web Application revolving around racing around grocery stores to try to scan certain items the quickest. This is a first-of-its-kind app that has never been done before, and probably won’t be done again.

Project Goals: [Insert Goals Here]

Release Plan: [Create New Release Plan]

Sprint Reports are located in the main branch under the "Sprint_Reports" folder.

Kanban board is located under GitHub projects; however, it is inaccessible to people outside of the project team.  This is the state of the Kanban board as of 3/12/2026.
<img width="1685" height="966" alt="image" src="https://github.com/user-attachments/assets/daaa73cf-d8f9-42e0-84f1-4c1bec322635" />


Source Code: Source code is split into two primary branches, one for front-end development (insert name here) and one for back-end/prototyping (insert name here).  These two branches will be merged in a future sprint as we work towards a final deliverable.  

Coding Standards

Documenation Standards

Development Environment:  The project is built on top of Node.JS.  The server is a Node.JS application which is able to serve up a webpage created in HTML/CSS.  The server utilizes the Socket.IO platform in order to facilitate real-time client-server communication for the game.  The server also utilizes a SQLite database for product and gameplay data storage.  

Deployment Environment

Version Management:
Right now, as soon as we finish with our prototype, it will be published as version 0.1.0.  Our prototype is currently at version 0.0.3.  

Test plan, tests performed, and analysis reports:
Most tests have been automatic so far, as we have still been trying to find a proper way to organize the work for it to actually be automated. It shouldn't be hard to do, the current plan for it is to use Selenium for the following:

Start a lobby
Have a second join lobby
Check the items
Check the items scan barcodes
Input an incorrect barcode
Check if it says wrong item
Input correct items
Check that player wins
Check that player loses

Once this is done, we can make sure that everyone on the team knows how to run the test system, and can test it before pushing to make sure nothing breaks. Besides that, it might be a little bit easier to do manual testing due to the subject of the project, and to do so by having a "test" mode where it picks the same few items, and we can have those barcodes ready for the scan test, and then have the regular gamemode to make sure that the lobby and random items work.

One way it could be done that we were also considering is having one test, and have a setting for semi-auto or auto, with semi-auto grabbing those same items and allowing the user to scan it, or auto grabbing random items and testing it with the barcodes.


Change Management

Definition of Ready

Definition of Done

Architectural Design

Detailed Design

Database Design
![MartRacers_ERD](https://github.com/user-attachments/assets/d5418983-b085-4c50-9428-b682640f50e6)


UI/UX Design
![Image_3-12-26_at_9 36_AM](https://github.com/user-attachments/assets/ac9dc856-8b69-4563-9e28-a00fb45292eb)
![Image_3-12-26_at_9 35_AM](https://github.com/user-attachments/assets/d89f11fb-253a-4ac3-afb7-1ef7243dbc55)

