# MartRacers

Project Link: https://martracers.quaglabs.net

To Run Project, you will need Node.JS. In the project folder, run:
```
npm install
node server.js
```
Connect clients to the server printed out in the console :D

Product Vision Statement: For shoppers who need a more entertaining shopping experience when they go to their favorite superstore. The MartRacers Web Application is a Web Application revolving around racing around grocery stores to try to scan certain items the quickest. This is a first-of-its-kind app that has never been done before, and probably won’t be done again.

Project Goal: To create a multiplayer based-game utilizing new frameworks that the team is unfamiliar with that has real-time communication between client and server and works between mulitple devices.  The game should also have lobbies and the way to find games or "matchmake."
Note: Matchmaking was dropped during development as it fell out of scope with the time we had to complete the project.

Release Plan: Our initial release plan had us doing Basic Server/Client testing within this sprint.  We are currently ahead of schedule, as we tested our prototype in Sprint 4 and are now developing the rest of the game logic this sprint and next sprint.  Our release plan now looks like this:
- Sprint 6: Finish implementing game logic
- Sprint 7: Creating Win Conditions for Players and finish prototypes for front-end
- Sprint 8: Finalize gameplay loop (for release v0.1.0) and integrate front-end into product.
- Sprint 9: Focus on bug fixes and polishing the game, receive feedback from all members about last changes.
- Sprint 10: Finish up documentation and deliverables.
Update (4/16/2026): Sprint 9 is marking the end of development of the product, leading to our first release. Although our release plan did not work out 1:1 of how we planned, we still are ready to spend Sprint 10 on documentation, bug fixes, and any other final elements to the project.
Final Update: We followed this release plan fairly closely, with getting the MVP done by sprint 8, with bug fixes and deliverables being a focus in sprints 9 and 10.   

Sprint Reports are located in the main branch under the "Sprint_Reports" folder.

Kanban board is located under GitHub projects and can be found on the Projects tab of the repository, or at https://github.com/users/willpaxton/projects/2
Midterm 1 Kanban Board:
<img width="1685" height="966" alt="image" src="https://github.com/user-attachments/assets/daaa73cf-d8f9-42e0-84f1-4c1bec322635" />
Midterm 2 Kanban Board:
<img width="1341" height="423" alt="image" src="https://github.com/user-attachments/assets/86459d4f-b869-4b9b-941a-cfac635112dd" />
Final Kanban Board:
<img width="1820" height="762" alt="image" src="https://github.com/user-attachments/assets/53926f4e-c2f6-4cf3-9bc7-2d48fbdd9131" />


Source Code: Source code is split into two primary branches, one for front-end development (FrontEnd) and one for back-end/prototyping (prototype).  These two branches will be merged in a future sprint as we work towards a final deliverable.  

Coding Standards: As most developers are doing their own work in their own parts of the project, no major coding standards have been implemented. As we begin to merge parts of the project, the team will discuss coding standards and agree on a standard for this.  

Documenation Standards: Documents follow templates shared around the team.  Documentation also takes the place of code comments within the code to explain reasoning and functionality of some implementations.  We plan to work more with creating structured documentation in the next few sprints.

Development Environment:  The project is built on top of Node.JS.  The server is a Node.JS application which is able to serve up a webpage created in HTML/CSS.  The server utilizes the Socket.IO platform in order to facilitate real-time client-server communication for the game.  The server also utilizes a SQLite database for product and gameplay data storage.  

Deployment Environment: The project is currently ran manually using a command-line interface.

Version Management:
Right now, as soon as we finish with our prototype, it will be published as version 0.1.0.  Our prototype is currently at version 0.0.3.  
As of sprint 9, we completed what we would consider 1.0.0 of the project, with Sprint 10 focused on bug fixes and moving to 1.0.1

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
Final Update: We were able to use GitHub Actions in order to implement testing in this above way.  We used Selenium to check that lobbies would open, clients could connect to them, clients could scan items, and that each client knew when the game was over. We had a tweak the tests a few times, especially as major changes were made to the product, but this ultimately proved to not be super difficult to do in the long run, and the time invested into automated testing was worth it for the team.

Change Management Approach:
During each scrum meeting and sprint transition, group members are allowed to give whatever feedback they have about the project deliverables so far. Along with this, the product owner is allowed to give feedback about each task completed in a sprint.  This allows the team to quickly adjust to feedback and add PBIs to the backlog based on suggested changes to ensure that the product meets the standards needed.  

Definition of Ready:
The team has been accepting tasks into the sprint whenever they fall in line with our Release Plan and Sprint Goal for each sprint.  We have been making a sprint goal during each sprint transitions and pick tasks based on what needs to be done to achieve that sprint goal.  A few tasks have been put as optional in case we have extra sprints to develop those specific items.  
Update (4/14/2026): At this point in the project, tasks have to be nessecary to the project to be included in a sprint.  Due to the time constraints on the project, we have to be much more selective about the items that are being worked on week-to-week in order to meet the minimum viable product for this project.  

Definition of Done:
We consider a task as done whenever all members on the team are satisfied with the result of the specific task. This was showcased within the acceptance of the front-end design as team members had disagreements about the look of it, which took multiple sprints to get to a design the team liked.
Update (4/14/2026): Over the past few sprints, tasks have been under a higher level of scrutiny as we build towards a completed game. At this point in development, we want to ensure that bugs are not be introduced into the product to allow us more time to fix other bugs during the last few sprints. 

DevOps Implementation:
Our implementation of the first way of DevOps was to included automated testing in our GitHub repository. A GitHub action triggers that starts a Selenium test that checks that basic gameplay functionality is working between the server and two clients. This helped the team to catch errors in our code changes early on and helped us to save time by reducing the amount of manual testing that was required.
Our implementation of the second way of DevOps was with product metrics. The type that we tried to implement into the project was by tracking statistics on items scanned and skipped, that way, we would receive feedback on if our item pool was good or not. We also would have included more info about game times and user statistics if we had more time on the project.
For the third way of DevOps, we allowed all members to share their ideas freely throughout the team, especially as many of us had not created a server-client application before, being able to freely brainstorm helped us to shape the product through our ideas of framework and implementation.  Members also freely added features to the product that they thought would be good additions. Even if it overall was not beneficial to the project, allowing members to try new things helped us to shape some of the features that were included in our final release.  

Security Features:
The primary security feature implemented on this version of the site was the introducion of an SSL certificate in order to secure client connections to the server. Along with this, the live deployment of the application is behind Cloudflare, giving DDOS and AI-bot scraping protection. With more development time, we wanted to add users, which would have allowed us to implement security on the user data/database.  

Architectural Design:
This project uses a client-server architecture, where the client and server will be communicating back and forth to deliver certain game data.  

Detailed Design:
<img width="2756" height="3009" alt="MartRacers - Game Architecture Flow" src="https://github.com/user-attachments/assets/2c1a6397-a8bc-4c9d-86b1-b2052ee7c003" />


Database Design:

![MartRacers_ERD](https://github.com/user-attachments/assets/d5418983-b085-4c50-9428-b682640f50e6)
The users section of the database was scrapped due to features that we believed were outside of our MVP.

UI/UX Design:
![Image_3-12-26_at_9 36_AM](https://github.com/user-attachments/assets/ac9dc856-8b69-4563-9e28-a00fb45292eb)
![Image_3-12-26_at_9 35_AM](https://github.com/user-attachments/assets/d89f11fb-253a-4ac3-afb7-1ef7243dbc55)
Final UI/UX Designs:
<img width="519" height="446" alt="Screenshot 2026-05-03 061619" src="https://github.com/user-attachments/assets/7b237cfa-567a-411c-9bf7-52a6b8044e6f" />
<img width="445" height="596" alt="Screenshot 2026-05-03 061650" src="https://github.com/user-attachments/assets/e8cc7cb8-de3c-48ab-b337-3dfdd9384ba4" />
<img width="1092" height="672" alt="Screenshot 2026-05-03 061639" src="https://github.com/user-attachments/assets/de9785bd-0a39-434d-9a5b-da68ca1b0731" />

