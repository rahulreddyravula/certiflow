"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateService = void 0;
const database_1 = require("../../database");
class CandidateService {
    static async getCandidates(filter) {
        const where = {};
        if (filter.batchId) {
            where.batchId = filter.batchId;
        }
        if (filter.assessmentStatus && filter.assessmentStatus !== 'ALL') {
            where.assessmentStatus = filter.assessmentStatus;
        }
        if (filter.search && filter.search.trim()) {
            const q = filter.search.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { courseName: { contains: q, mode: 'insensitive' } },
                { trainingCentreName: { contains: q, mode: 'insensitive' } },
                { districtName: { contains: q, mode: 'insensitive' } },
            ];
        }
        const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
        const offset = Math.max(filter.offset || 0, 0);
        const [candidates, total] = await Promise.all([
            database_1.prisma.candidate.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
                include: {
                    certificate: {
                        select: {
                            id: true,
                            certificateNumber: true,
                            status: true,
                        },
                    },
                },
            }),
            database_1.prisma.candidate.count({ where }),
        ]);
        return {
            candidates,
            total,
            limit,
            offset,
        };
    }
}
exports.CandidateService = CandidateService;
