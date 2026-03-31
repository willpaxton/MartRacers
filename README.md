# MartRacers
Product Vision Statement: For shoppers who need a more entertaining shopping experience when they go to their favorite superstore. The MartRacers Web Application is a Web Application revolving around racing around grocery stores to try to scan certain items the quickest. This is a first-of-its-kind app that has never been done before, and probably won’t be done again.

Project Goal: To create a multiplayer based-game utilizing new frameworks that the team is unfamiliar with that has real-time communication between client and server and works between mulitple devices.  The game should also have lobbies and the way to find games or "matchmake."

Release Plan: Our initial release plan had us doing Basic Server/Client testing within this sprint.  We are currently ahead of schedule, as we tested our prototype in Sprint 4 and are now developing the rest of the game logic this sprint and next sprint.  Our release plan now looks like this:
- Sprint 6: Finish implementing game logic
- Sprint 7: Creating Win Conditions for Players and finish prototypes for front-end
- Sprint 8: Finalize gameplay loop (for release v0.1.0) and integrate front-end into product.
- Sprint 9: Focus on bug fixes and polishing the game, receive feedback from all members about last changes.
- Sprint 10: Finish up documentation and deliverables.

Sprint Reports are located in the main branch under the "Sprint_Reports" folder.

Kanban board is located under GitHub projects; however, it is inaccessible to people outside of the project team.  This is the state of the Kanban board as of 3/12/2026.
<img width="1685" height="966" alt="image" src="https://github.com/user-attachments/assets/daaa73cf-d8f9-42e0-84f1-4c1bec322635" />

Source Code: Source code is split into two primary branches, one for front-end development (FrontEnd) and one for back-end/prototyping (prototype).  These two branches will be merged in a future sprint as we work towards a final deliverable.  

Coding Standards: As most developers are doing their own work in their own parts of the project, no major coding standards have been implemented. As we begin to merge parts of the project, the team will discuss coding standards and agree on a standard for this.  

Documenation Standards: Documents follow templates shared around the team.  Documentation also takes the place of code comments within the code to explain reasoning and functionality of some implementations.  We plan to work more with creating structured documentation in the next few sprints.

Development Environment:  The project is built on top of Node.JS.  The server is a Node.JS application which is able to serve up a webpage created in HTML/CSS.  The server utilizes the Socket.IO platform in order to facilitate real-time client-server communication for the game.  The server also utilizes a SQLite database for product and gameplay data storage.  

Deployment Environment: The project is currently ran manually using a command-line interface.  We hope to implement containerization in a future sprint.  

Version Management:
Right now, as soon as we finish with our prototype, it will be published as version 0.1.0.  Our prototype is currently at version 0.0.3.  

Test plan, tests performed, and analysis reports:
Most tests have been automatic so far, as we have still been trying to find a proper way to organize the work for it to actually be automated. It shouldn't be hard to do, the current plan for it is to use Selenium for the following:

- Start a lobby
- Have a second join lobby
- Check the items
- Check the items scan barcodes
- Input an incorrect barcode
- Check if it says wrong item
- Input correct items
- Check that player wins
- Check that player loses

Once this is done, we can make sure that everyone on the team knows how to run the test system, and can test it before pushing to make sure nothing breaks. Besides that, it might be a little bit easier to do manual testing due to the subject of the project, and to do so by having a "test" mode where it picks the same few items, and we can have those barcodes ready for the scan test, and then have the regular gamemode to make sure that the lobby and random items work. One way it could be done that we were also considering is having one test, and have a setting for semi-auto or auto, with semi-auto grabbing those same items and allowing the user to scan it, or auto grabbing random items and testing it with the barcodes.

Change Management Approach:
During each scrum meeting and sprint transition, group members are allowed to give whatever feedback they have about the project deliverables so far. Along with this, the product owner is allowed to give feedback about each task completed in a sprint.  This allows the team to quickly adjust to feedback and add PBIs to the backlog based on suggested changes to ensure that the product meets the standards needed.  

Definition of Ready:
The team has been accepting tasks into the sprint whenever they fall in line with our Release Plan and Sprint Goal for each sprint.  We have been making a sprint goal during each sprint transitions and pick tasks based on what needs to be done to achieve that sprint goal.  A few tasks have been put as optional in case we have extra sprints to develop those specific items.  

Definition of Done:
We consider a task as done whenever all members on the team are satisfied with the result of the specific task. This was showcased within the acceptance of the front-end design as team members had disagreements about the look of it, which took multiple sprints to get to a design the team liked.  

Architectural Design:
This project uses a client-server architecture, where the client and server will be communicating back and forth to deliver certain game data.  

Detailed Design:
<img width="2756" height="3009" alt="MartRacers - Game Architecture Flow" src="https://github.com/user-attachments/assets/2c1a6397-a8bc-4c9d-86b1-b2052ee7c003" />


Database Design:

![MartRacers_ERD](https://github.com/user-attachments/assets/d5418983-b085-4c50-9428-b682640f50e6)


UI/UX Design:
![Image_3-12-26_at_9 36_AM](https://github.com/user-attachments/assets/ac9dc856-8b69-4563-9e28-a00fb45292eb)
![Image_3-12-26_at_9 35_AM](https://github.com/user-attachments/assets/d89f11fb-253a-4ac3-afb7-1ef7243dbc55)