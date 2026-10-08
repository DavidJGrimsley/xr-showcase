# Ejection Cleanup

Generated after `mds eject` on 2026-10-08T01:41:55.716Z.

Complete this checklist after the app shell and core flows are stable, before polish and release.

Retained: Settings Page, Data Adapter
Ejected: Stylist, Exposition Pages, Expo SDK 56 Exposition, create-expo-stack Starter Components, Auth Flow, Software Mansion Demos

## Tasks

- [x] Update `project/guidelines.md` and agent instructions so they no longer describe ejected Stylist.
- [x] Remove leftover Stylist mentions from project/guidelines.md.
- [x] Remove dangling imports, links, or route registrations for ejected Stylist in src/navigation/root-layout.tsx.
- [x] Update `project/guidelines.md` and agent instructions so they no longer describe ejected Exposition Pages.
- [x] Remove leftover Exposition Pages mentions from project/guidelines.md, project/info.md.
- [x] Remove dangling imports, links, or route registrations for ejected Exposition Pages in src/app/exposition/data.tsx, src/features/exposition/data-screen.tsx, src/features/home/home-screen.tsx, src/navigation/root-layout.tsx.
- [x] Update `project/guidelines.md` and agent instructions so they no longer describe ejected Expo SDK 56 Exposition.
- [x] Remove leftover Expo SDK 56 Exposition mentions from project/info.md.
- [x] Remove dangling imports, links, or route registrations for ejected Expo SDK 56 Exposition in src/navigation/root-layout.tsx.
- [x] Update `project/guidelines.md` and agent instructions so they no longer describe ejected create-expo-stack Starter Components.
- [x] Search remaining app files for leftover imports or routes that pointed at ejected create-expo-stack Starter Components.
- [x] Update `project/guidelines.md` and agent instructions so they no longer describe ejected Auth Flow.
- [x] Remove leftover Auth Flow mentions from project/guidelines.md, project/info.md.
- [x] Search remaining app files for leftover imports or routes that pointed at ejected Auth Flow.
- [x] Update `project/guidelines.md` and agent instructions so they no longer describe ejected Software Mansion Demos.
- [x] Remove dangling imports, links, or route registrations for ejected Software Mansion Demos in src/components/exposition/index.ts.
- [x] Remove unused packages that only existed for ejected components, then run the project install and Doctor.


## Completed October 7, 2026

Removed every exposition route, reference screen and demo component; cleaned Home links and the navigation stack. Preserved the current theme, Settings and local data adapter. The Settings auth adapter type is retained as a shared dependency; no auth flow remains. Removed the color-picker dependency and refreshed the lockfile. Validated with MDS Doctor, TypeScript, Expo Doctor and iOS JavaScript export.
