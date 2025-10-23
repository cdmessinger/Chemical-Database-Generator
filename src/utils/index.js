//Third party imports
import puppeteer from "puppeteer";
import fetch from "node-fetch";
import fs, { stat } from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { resourceLimits } from "worker_threads";

import * as pdfjsLibRaw from 'pdfjs-dist/legacy/build/pdf.js';
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw; //export this

import { text } from 'stream/consumers';
import ExcelJS from 'exceljs';
import { exec } from 'child_process';


//My Utilities
import { fetchFromPubChem } from "../apiCaller/api_requestor.js";
import { parsePubChemData } from "../apiCaller/data_parser.js";
import { scrapeFisherSDS } from "../sdsScraper/scraper.js";
import { importExcel } from "../importerExporter/excel_importer.js";
import { exportToExcel } from "../importerExporter/exportToExcel.js";
import { sleep } from "./sleep.js";
import { pdfParse } from "../sdsScraper/pdfparser.js";
import { buildChemicalData } from "./buildChemicalData.js";
import { run } from '../core/run.js';


//exports
export { 
    puppeteer,
    fetch,
    fs,
    fsp,
    stat,
    path,
    resourceLimits,
    pdfjsLib,
    text,
    ExcelJS,
    exec,
    //
    fetchFromPubChem,
    parsePubChemData,
    scrapeFisherSDS,
    importExcel,
    exportToExcel,
    sleep,
    pdfParse,
    buildChemicalData,
    run
}