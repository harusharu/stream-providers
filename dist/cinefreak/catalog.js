"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// providers/cinefreak/catalog.ts
var catalog_exports = {};
__export(catalog_exports, {
  catalog: () => catalog,
  genres: () => genres
});

var catalog = [
  { title: "Latest Releases", filter: "" },
  { title: "WEB-Series", filter: "/web-series" },
  { title: "Dual Audio", filter: "/dual-audio" },
  { title: "Hindi Movies", filter: "/hindi-movies" },
  { title: "English Movies", filter: "/english-movies" },
  { title: "Spanish", filter: "/spanish" }
];
var genres = [
  { title: "Action & Adventure", filter: "/genre/action-adventure" },
  { title: "Comedy", filter: "/genre/comedy" },
  { title: "Drama", filter: "/genre/drama" },
  { title: "Romance", filter: "/genre/romance" },
  { title: "Crime", filter: "/genre/crime" },
  { title: "Sci-Fi", filter: "/genre/sci-fi" },
  { title: "Thriller", filter: "/genre/thriller" },
  { title: "4K", filter: "/genre/4k" }
];
exports.catalog = catalog;
exports.genres = genres;
// Annotate the CommonJS export names for ESM import in node:

