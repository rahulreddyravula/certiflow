"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateController = void 0;
const candidate_service_1 = require("./candidate.service");
class CandidateController {
    static async list(req, res, next) {
        try {
            const { search, assessmentStatus, batchId, limit, offset } = req.query;
            const result = await candidate_service_1.CandidateService.getCandidates({
                search,
                assessmentStatus,
                batchId,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0,
            });
            res.json({
                success: true,
                ...result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CandidateController = CandidateController;
