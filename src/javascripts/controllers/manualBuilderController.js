(function () {
	"use strict";

	angular
		.module('scheedule')
		.controller('ManualBuilderController', ['$rootScope','$filter','AuthService','CourseDataService', 'AgendaService', ManualBuilderController]);

	// Manual Agenda Builder Controller
	// ----------------
	//
	// Coordinates creating of agenda view, course selection accordions,
	// course searching and agenda/accordion interactions.
	function ManualBuilderController ($rootScope, $filter, AuthService, CourseDataService, AgendaService) {
		var mb = this;
		mb.init = function () {
			console.log("Loaded manual builder controller.");
			mb.courses = [];

			// Load courses from Course Data Service.
			CourseDataService.getCourses(function (someCourses) {
				for (var course of someCourses) {
					mb.courses.push(course);
				}
			}, function (err) {
				console.log("Couldn't load course data from backend.");
			});

			// Listen for events broadcast from other controllers on the root scope.
			$rootScope.$on('saveSchedule', function () {
				mb.openDialog("save-dialog");
			});

			$rootScope.$on('loadSchedules', function () {
				mb.loadSchedules();
			});

			$rootScope.$on('presentLoginModal', function () {
				mb.openDialog("login-dialog");
			});

			// Initialize blank agenda.
			mb.agenda = AgendaService.blankAgenda();
		};

		// Fired upon clicking a section.
		mb.clickSection = function (section) {
			if (section.active) {
				// If we're clicking a selected section, clear its active flag.
				// Then remove it from the calendar, and return it to the
				// mouseentered state.
				section.active = false;
				mb.agenda.removeSeriesForSection(section);
				mb.highlightSection(section);
			} else {
				// If we clicked an unselected section, exit the mouseentered
				// state. Set its active flag and add it to the agenda.
				mb.unhighlightSection(section);
				section.active = true;
				mb.agenda.addNormalSeriesForSection(section);
			}
		};

		// Fired when the mosueenter event occurs on a section.
		mb.highlightSection = function (section) {
			// Only add the translucent hover section to the agenda if the section
			// isn't already selected.
			if (!section.active) {
				section.hovering = true;
				mb.agenda.addHoverSeriesForSection(section);
			}
		};

		// Fired when the mosueleave event occurs on a section.
		mb.unhighlightSection = function (section) {
			// Only remove the hover section from the agenda if the section was
			// already being hovered over (i.e. prevent removing selected sections).
			if (section.hovering) {
				section.hovering = false;
				mb.agenda.removeSeriesForSection(section);
			}
		};

		mb.deleteCourse = function (course, shouldHover) {
			for (var section of course.sections) {
				if (section.active || section.hovering) {
					section.active = false;
					section.hovering = false;
					mb.agenda.removeSeriesForSection(section);
					if (shouldHover) {
						section.hovering = true;
						mb.highlightSection(section);
					}
				}
			}
		};

		mb.undeleteCourse = function (course) {
			for (var section of course.sections) {
				if (section.hovering) {
					mb.unhighlightSection(section);
					section.active = true;
					mb.agenda.addNormalSeriesForSection(section);
				}
			}
		};

		mb.deleteSchedule = function (schedule) {
			CourseDataService.deleteSchedule(schedule, function () {
				mb.loadSchedules();
			}, function (err) {
				console.log("Error deleting schedule.");
				console.log(err);
			});
		};

		// Save the current set of sections on the calendar.
		mb.saveSchedule = function () {
			console.log("Saving schedule...");
			var CRNList = [];
			// Grab the active section from our list of courses.
			for (var CRN of $filter('ActiveCRNFilter')(mb.courses)) {
				CRNList.push(CRN);
			}
			// Send that list off to the API.
			CourseDataService.saveSchedule(CRNList,mb.scheduleTitle,function () {
				console.log("Saved schedule.");
				// If things went ok, close the save dialog.
				mb.closeDialog("save-dialog");
			}, function (err) {
				// If there was an error (not logged in, not inet access, etc.)
				// display an error dialog.
				console.log("Error saving schedule.");
				console.log(err);
			});
		};

		// Load up a list of schedules to pick from in our load schedules dialog.
		mb.loadSchedules = function () {
			console.log("Loading schedules...");
			// Get the list of schedules from the API.
			CourseDataService.loadSchedules(function (schedules) {
				console.log("Loaded schedules.");
				// Throw the data we got back from the API into the list of possible
				// schedules to load on our load dialog.
				mb.loadedSchedules = schedules
				mb.openDialog("manage-dialog");
			}, function (err) {
				// If we had trouble getting the list of schedules, show an error
				// dialog.
				console.log("Error loading schedules.");
				console.log(err);
			});
		};

		// Display a selected, loaded schedule into our calendar.
		mb.displaySchedule = function () {
			mb.agenda = AgendaService.blankAgenda();
			// Get the HTML element for the list of schedules.
			var scheduleList = document.getElementById("schedule-names");
			// Get the list of CRNs for the selected schedule (this index is set 
			// in the ng-click listener for schedule-names)
			var CRNList = mb.loadedSchedules[mb.selectedScheduleIndex].CRNList;
			var activatedSections = [];
			// Iterate through all CRNs in our list.
			for (var crnIndex = 0; crnIndex < CRNList.length; crnIndex++) {
				// Iterate through all sections in all courses in mb.courses.
				for (var courseIndex = 0; courseIndex < mb.courses.length; courseIndex++) {
					for (var sectionIndex = 0; sectionIndex < mb.courses[courseIndex].sections.length; sectionIndex++) {
						// If the section we're looking at is on our list of CRNs, add it to our calendar.
						// Also add it 
						if (CRNList[crnIndex] == mb.courses[courseIndex].sections[sectionIndex].id && !activatedSections.includes(mb.courses[courseIndex].sections[sectionIndex])) {
							mb.agenda.addNormalSeriesForSection(mb.courses[courseIndex].sections[sectionIndex]);
							mb.courses[courseIndex].sections[sectionIndex].active = true;
							activatedSections.push(mb.courses[courseIndex].sections[sectionIndex]);
						}
					}
				}
			}
			mb.closeDialog("manage-dialog");
		}

		mb.selectSchedule = function (event) {
			var selectedScheduleName = event.target.innerHTML;
			if (selectedScheduleName != "") {
				selectedScheduleName = selectedScheduleName.slice(0, selectedScheduleName.indexOf("<")).trim();
			}
			console.log(selectedScheduleName);
			for (var loadedScheduleIndex = 0; loadedScheduleIndex < mb.loadedSchedules.length; loadedScheduleIndex++) {
				var schedule = mb.loadedSchedules[loadedScheduleIndex];
				if (schedule.name == selectedScheduleName) {
					mb.selectedScheduleIndex = loadedScheduleIndex;
				}
			}
		};

		mb.openDialog = function (name) {
			var dialog = document.getElementById(name);
			dialog.open();
			window.setTimeout(function () {
				dialog.center();
			},1);
		}

		mb.closeDialog = function (name) {
			var dialog = document.getElementById(name);
			dialog.close();
		}

		mb.init();
	}
})();