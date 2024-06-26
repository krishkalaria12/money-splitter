import { connect } from "@/lib/db";
import { Group } from "@/models/group.models";
import { createError } from "@/utils/ApiError";
import { createResponse } from "@/utils/ApiResponse";
import { auth } from "@clerk/nextjs/server";
import mongoose, { isValidObjectId } from "mongoose";

export async function PATCH(request: Request) {
    await connect();

    try {
        const { groupId, memberId } = await request.json();
        
        const { has, sessionClaims } = auth();
        const currentUserId = (sessionClaims?.mongoId as { mongoId: string })?.mongoId;

        if (!has) {
            throw createError("Unauthorized", 401, false);
        }

        if (!currentUserId) {
            throw createError("Unauthorized: User not logged in", 401, false);
        }

        if (!isValidObjectId(currentUserId)) {
            throw createError("Invalid user ID", 400, false);
        }

        if (!groupId || !memberId) {
            throw createError("Invalid group ID or member ID", 400, false);
        }

        if (!isValidObjectId(groupId) || !isValidObjectId(memberId)) {
            throw createError("Invalid group ID or member ID", 400, false);
        }

        const group = await Group.findById(groupId);

        if (!group) {
            throw createError("Invalid group ID", 404, false);
        }

        const userId = new mongoose.Types.ObjectId(currentUserId);
        
        if (!group.admin.equals(userId)) {
            throw createError("Unauthorized: You are not the admin of this group", 401, false);
        }

        if (!group.members.includes(new mongoose.Types.ObjectId(memberId))) {
            throw createError("Invalid member ID", 404, false);
        }

        if (group.admin.equals(memberId)) {
            throw createError("Invalid member ID: Cannot change admin to self" ,400, false);
        }

        const member = new mongoose.Types.ObjectId(memberId)
        group.admin = member;

        await group.save();

        return Response.json(
            createResponse(
                "Group admin changed successfully", 200, true, group
            )
        );
    } catch (error) {
        console.error("Error while changing group admin:", error);
        throw createError(
            "Failed to change group admin", 500, false,
        );
    }
}