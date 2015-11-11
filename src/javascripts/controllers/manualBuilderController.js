(function () {
    "use strict";

    angular
        .module('scheedule')
        .controller('ManualBuilderController', ['$rootScope','AuthService','CourseDataService', 'AgendaService', ManualBuilderController]);

    // Manual Agenda Builder Controller
    // ----------------
    //
    // Coordinates creating of agenda view, course selection accordions,
    // course searching and agenda/accordion interactions.
    function ManualBuilderController ($rootScope, AuthService, CourseDataService, AgendaService) {
        var mb = this;
        mb.init = function () {
            console.log("Loaded manual builder controller.");
            mb.courses = [];
            mb.as = AgendaService;

            // Load courses from Course Data Service.
            CourseDataService.getCourses(function (someCourses) {
                for (var course of someCourses) {
                    mb.courses.push(course);
                }
            }, function (err) {
                console.log("Couldn't load course data from backend.");
            });

            $rootScope.$on('saveSchedule', function () {
                var dialog = document.getElementById("save-dialog");
                dialog.toggle();
            });

            $rootScope.$on('loadSchedules', function () {
                mb.loadSchedules();
            });

            $rootScope.$on('presentLoginModal', function () {
                mb.presentLoginModal();
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

        mb.saveSchedule = function () {
            console.log("Saving schedule...");
            CourseDataService.saveSchedule(['11111'],mb.scheduleTitle,function () {
                console.log("Saved schedule.");
            }, function (err) {
                console.log("Error saving schedule.");
                console.log(err);
            });
        };

        mb.loadSchedules = function () {
            console.log("Loading schedules...");
            CourseDataService.loadSchedules(function (schedules) {
                console.log("Loaded schedules.");
                console.log(schedules.data);
                mb.loadedSchedules = schedules.data;
                var dialog = document.getElementById("load-dialog");
                dialog.toggle();
            }, function (err) {
                console.log("Error loading schedules.");
                console.log(err);
            });
        };

        mb.presentLoginModal = function () {
            var dialog = document.getElementById("login-dialog");
            dialog.toggle();
        };

        mb.init();
    }
})();