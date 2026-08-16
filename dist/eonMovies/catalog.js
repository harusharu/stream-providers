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

// providers/eonMovies/catalog.ts
var catalog_exports = {};
__export(catalog_exports, {
  catalog: () => catalog,
  genres: () => genres
});

var catalog = [
  { title: "Latest", filter: "" },
  { title: "Bollywood", filter: "bollywood" },
  { title: "Hollywood", filter: "hollywood" },
  { title: "South Indian", filter: "tollywood" },
  { title: "Web Series", filter: "series" },
  { title: "Netflix", filter: "netflix" }
];
var genres = [];
exports.catalog = catalog;
exports.genres = genres;
// Annotate the CommonJS export names for ESM import in node:

