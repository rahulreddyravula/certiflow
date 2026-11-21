"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchController = void 0;
const zod_1 = require("zod");
const XLSX = __importStar(require("xlsx"));
const batch_service_1 = require("./batch.service");
const approval_service_1 = require("../approval/approval.service");
const database_1 = require("../../database");
const createBatchSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').trim(),
    courseName: zod_1.z.string().min(1, 'Course name is required').trim(),
    districtId: zod_1.z.string().optional(),
    trainingCentreId: zod_1.z.string().optional(),
});
const decisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(['APPROVE', 'REJECT', 'RETURN']),
    comments: zod_1.z.string().optional(),
});
const resubmitSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
});
class BatchController {
    static async create(req, res, next) {
        try {
            const data = createBatchSchema.parse(req.body);
            const user = req.user;
            let districtId = data.districtId || user.districtId;
            let trainingCentreId = data.trainingCentreId || user.trainingCentreId;
            // If missing from token, fallback to fetching from DB for this user
            if (!trainingCentreId || !districtId) {
                const dbUser = await database_1.prisma.user.findUnique({
                    where: { id: user.id },
                    include: { district: true, trainingCentre: true },
                });
                if (dbUser) {
                    districtId = districtId || dbUser.districtId || dbUser.district?.id;
                    trainingCentreId = trainingCentreId || dbUser.trainingCentreId || dbUser.trainingCentre?.id;
                }
            }
            // If training centre is known, guarantee districtId from the training centre
            if (!districtId && trainingCentreId) {
                const tc = await database_1.prisma.trainingCentre.findUnique({ where: { id: trainingCentreId } });
                if (tc)
                    districtId = tc.districtId;
            }
            if (!trainingCentreId) {
                return res.status(400).json({ success: false, error: 'A Training Centre association is required to create a batch.' });
            }
            if (!districtId) {
                return res.status(400).json({ success: false, error: 'A District association is required to create a batch.' });
            }
            const batch = await batch_service_1.BatchService.createBatch({
                title: data.title,
                courseName: data.courseName,
                districtId,
                trainingCentreId,
            }, user);
            res.status(201).json({ success: true, batch });
        }
        catch (error) {
            next(error);
        }
    }
    static async list(req, res, next) {
        try {
            const { status, search, limit } = req.query;
            const batches = await batch_service_1.BatchService.getBatches(req.user, {
                status,
                search,
                limit: limit ? parseInt(limit, 10) : 100,
            });
            res.json({ success: true, batches });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const batch = await batch_service_1.BatchService.getBatchById(req.params.id);
            res.json({ success: true, batch });
        }
        catch (error) {
            next(error);
        }
    }
    static async uploadCsv(req, res, next) {
        try {
            if (!req.file) {
                res.status(400).json({ success: false, error: 'No CSV or Excel spreadsheet file provided.' });
                return;
            }
            let csvContent = '';
            const lowerName = req.file.originalname.toLowerCase();
            if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                csvContent = XLSX.utils.sheet_to_csv(sheet);
            }
            else {
                csvContent = req.file.buffer.toString('utf-8');
            }
            const result = await batch_service_1.BatchService.uploadCandidatesCsv(req.params.id, csvContent, req.file.originalname, req.user);
            if (!result.isValid) {
                res.status(422).json(result);
                return;
            }
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    static async submit(req, res, next) {
        try {
            const batch = await batch_service_1.BatchService.submitBatch(req.params.id, req.user);
            res.json({ success: true, batch, message: 'Batch successfully submitted for district approval.' });
        }
        catch (error) {
            next(error);
        }
    }
    static async districtDecision(req, res, next) {
        try {
            const data = decisionSchema.parse(req.body);
            const result = await approval_service_1.ApprovalService.recordDistrictDecision({
                batchId: req.params.id,
                decision: data.decision,
                comments: data.comments,
                user: req.user,
            });
            res.json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    static async qualityDecision(req, res, next) {
        try {
            const data = decisionSchema.parse(req.body);
            const batch = await approval_service_1.ApprovalService.recordQualityDecision({
                batchId: req.params.id,
                decision: data.decision,
                comments: data.comments,
                user: req.user,
            });
            res.json({ success: true, batch });
        }
        catch (error) {
            next(error);
        }
    }
    static async stateDecision(req, res, next) {
        try {
            const data = decisionSchema.parse(req.body);
            const batch = await approval_service_1.ApprovalService.recordStateDecision({
                batchId: req.params.id,
                decision: data.decision,
                comments: data.comments,
                user: req.user,
            });
            res.json({ success: true, batch });
        }
        catch (error) {
            next(error);
        }
    }
    static async resubmit(req, res, next) {
        try {
            const data = resubmitSchema.parse(req.body);
            const batch = await approval_service_1.ApprovalService.resubmitReturnedBatch(req.params.id, req.user, data.notes);
            res.json({ success: true, batch, message: 'Batch resubmitted for fresh district approval.' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BatchController = BatchController;
