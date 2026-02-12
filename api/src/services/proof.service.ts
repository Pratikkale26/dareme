import { prisma } from "../db/client";
import type { MediaType, ProofStatus } from "../generated/prisma/client";

/**
 * Create a proof record (called after on-chain submitProof tx + S3 upload).
 */
export async function createProof(input: {
    dareId: string;
    submitterId: string;
    mediaUrl: string;
    mediaType: MediaType;
    proofHash: string;
    caption?: string;
}) {
    return prisma.proof.create({
        data: {
            dareId: input.dareId,
            submitterId: input.submitterId,
            mediaUrl: input.mediaUrl,
            mediaType: input.mediaType,
            proofHash: input.proofHash,
            caption: input.caption || null,
        },
        select: {
            id: true,
            mediaUrl: true,
            mediaType: true,
            proofHash: true,
            caption: true,
            status: true,
            createdAt: true,
            submitter: {
                select: { id: true, displayName: true, xHandle: true, avatarUrl: true },
            },
        },
    });
}

/**
 * Get all proofs for a dare.
 */
export async function getProofsForDare(dareId: string) {
    return prisma.proof.findMany({
        where: { dareId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            mediaUrl: true,
            mediaType: true,
            proofHash: true,
            caption: true,
            status: true,
            createdAt: true,
            submitter: {
                select: { id: true, displayName: true, xHandle: true, avatarUrl: true },
            },
        },
    });
}

/**
 * Update proof status (approve/reject by challenger or webhook).
 */
export async function updateProofStatus(
    proofId: string,
    status: ProofStatus,
    rejectionReason?: string
) {
    return prisma.proof.update({
        where: { id: proofId },
        data: {
            status,
            rejectionReason: rejectionReason || null,
        },
    });
}

/**
 * Get the latest proof for a dare (the most recent submission).
 */
export async function getLatestProof(dareId: string) {
    return prisma.proof.findFirst({
        where: { dareId },
        orderBy: { createdAt: "desc" },
    });
}
