"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsvService = void 0;
const papaparse_1 = __importDefault(require("papaparse"));
class CsvService {
    // Normalize header names to match expected fields regardless of casing or spacing
    static normalizeKey(key) {
        return key
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, '');
    }
    static parseAndValidate(csvContent) {
        const parseResult = papaparse_1.default.parse(csvContent, {
            header: true,
            skipEmptyLines: 'greedy',
        });
        if (parseResult.errors && parseResult.errors.length > 0) {
            // Parse syntax error
            return {
                isValid: false,
                totalRows: 0,
                validRows: 0,
                invalidRows: 0,
                errors: parseResult.errors.map((e) => ({
                    row: e.row || 1,
                    field: 'CSV_FORMAT',
                    error: e.message,
                })),
                parsedCandidates: [],
            };
        }
        const rows = parseResult.data;
        if (rows.length === 0) {
            return {
                isValid: false,
                totalRows: 0,
                validRows: 0,
                invalidRows: 0,
                errors: [{ row: 0, field: 'FILE', error: 'CSV file is empty.' }],
                parsedCandidates: [],
            };
        }
        const errors = [];
        const parsedCandidates = [];
        const seenEmails = new Map();
        const seenPhones = new Map();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Standard phone: 10 to 14 digits optionally preceded by +
        const phoneRegex = /^\+?[0-9]{10,14}$/;
        rows.forEach((rawRow, index) => {
            const rowNumber = index + 2; // Row 1 is header
            const rowMap = {};
            for (const [k, v] of Object.entries(rawRow)) {
                rowMap[this.normalizeKey(k)] = (v || '').trim();
            }
            // Extract fields with multiple header synonyms
            const name = rowMap['candidatename'] || rowMap['name'] || '';
            const email = rowMap['candidateemail'] || rowMap['email'] || '';
            const phone = rowMap['phonenumber'] || rowMap['phone'] || rowMap['mobile'] || '';
            const course = rowMap['coursename'] || rowMap['course'] || '';
            const trainingCentre = rowMap['trainingcentre'] || rowMap['centre'] || rowMap['center'] || '';
            const district = rowMap['district'] || '';
            const dateStr = rowMap['completiondate'] || rowMap['date'] || '';
            const statusRaw = rowMap['assessmentstatus'] || rowMap['status'] || rowMap['result'] || '';
            let rowHasError = false;
            // 1. Name validation
            if (!name) {
                errors.push({ row: rowNumber, field: 'Candidate Name', error: 'Candidate name is required.' });
                rowHasError = true;
            }
            // 2. Email validation
            if (!email) {
                errors.push({ row: rowNumber, field: 'Candidate Email', error: 'Email address is required.' });
                rowHasError = true;
            }
            else if (!emailRegex.test(email)) {
                errors.push({ row: rowNumber, field: 'Candidate Email', error: 'Invalid email address format.', value: email });
                rowHasError = true;
            }
            else {
                const lowerEmail = email.toLowerCase();
                if (seenEmails.has(lowerEmail)) {
                    errors.push({
                        row: rowNumber,
                        field: 'Candidate Email',
                        error: `Duplicate email detected within batch (already used on row ${seenEmails.get(lowerEmail)}).`,
                        value: email,
                    });
                    rowHasError = true;
                }
                else {
                    seenEmails.set(lowerEmail, rowNumber);
                }
            }
            // 3. Phone validation
            const sanitizedPhone = phone.replace(/[\s-]/g, '');
            if (!sanitizedPhone) {
                errors.push({ row: rowNumber, field: 'Phone Number', error: 'Phone number is required.' });
                rowHasError = true;
            }
            else if (!phoneRegex.test(sanitizedPhone)) {
                errors.push({ row: rowNumber, field: 'Phone Number', error: 'Phone number must be 10-14 digits.', value: phone });
                rowHasError = true;
            }
            else {
                if (seenPhones.has(sanitizedPhone)) {
                    errors.push({
                        row: rowNumber,
                        field: 'Phone Number',
                        error: `Duplicate phone number detected within batch (already used on row ${seenPhones.get(sanitizedPhone)}).`,
                        value: phone,
                    });
                    rowHasError = true;
                }
                else {
                    seenPhones.set(sanitizedPhone, rowNumber);
                }
            }
            // 4. Course validation
            if (!course) {
                errors.push({ row: rowNumber, field: 'Course Name', error: 'Course name is required.' });
                rowHasError = true;
            }
            // 5. Training Centre validation
            if (!trainingCentre) {
                errors.push({ row: rowNumber, field: 'Training Centre', error: 'Training centre name is required.' });
                rowHasError = true;
            }
            // 6. District validation
            if (!district) {
                errors.push({ row: rowNumber, field: 'District', error: 'District name is required.' });
                rowHasError = true;
            }
            // 7. Completion Date validation
            if (!dateStr) {
                errors.push({ row: rowNumber, field: 'Completion Date', error: 'Completion date is required.' });
                rowHasError = true;
            }
            else {
                const parsedDate = new Date(dateStr);
                if (isNaN(parsedDate.getTime())) {
                    errors.push({ row: rowNumber, field: 'Completion Date', error: 'Invalid date format (expected YYYY-MM-DD).', value: dateStr });
                    rowHasError = true;
                }
            }
            // 8. Assessment Status validation
            const normalizedStatus = statusRaw.toUpperCase();
            if (!normalizedStatus) {
                errors.push({ row: rowNumber, field: 'Assessment Status', error: 'Assessment status is required.' });
                rowHasError = true;
            }
            else if (normalizedStatus !== 'PASSED' && normalizedStatus !== 'FAILED') {
                errors.push({
                    row: rowNumber,
                    field: 'Assessment Status',
                    error: "Assessment status must be either 'PASSED' or 'FAILED'.",
                    value: statusRaw,
                });
                rowHasError = true;
            }
            if (!rowHasError) {
                parsedCandidates.push({
                    name,
                    email: email.toLowerCase(),
                    phone: sanitizedPhone,
                    courseName: course,
                    trainingCentreName: trainingCentre,
                    districtName: district,
                    completionDate: new Date(dateStr),
                    assessmentStatus: normalizedStatus,
                });
            }
        });
        const totalRows = rows.length;
        const isValid = errors.length === 0;
        const invalidRows = new Set(errors.map((e) => e.row)).size;
        const validRows = totalRows - invalidRows;
        return {
            isValid,
            totalRows,
            validRows,
            invalidRows,
            errors,
            parsedCandidates: isValid ? parsedCandidates : [],
        };
    }
}
exports.CsvService = CsvService;
