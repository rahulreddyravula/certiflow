"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCsv = void 0;
const multer_1 = __importDefault(require("multer"));
// Use memory storage so we can parse buffer atomically
const storage = multer_1.default.memoryStorage();
exports.uploadCsv = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
        const isExcel = file.mimetype === 'application/vnd.ms-excel' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.originalname.toLowerCase().endsWith('.xlsx') ||
            file.originalname.toLowerCase().endsWith('.xls');
        if (isCsv || isExcel) {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV (.csv) and Excel (.xlsx, .xls) spreadsheet files are accepted.'));
        }
    },
});
