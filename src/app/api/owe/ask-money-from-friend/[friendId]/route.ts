import { connect } from "@/lib/db";
import { Owe } from "@/models/owe.models";
import { Transaction } from "@/models/transaction.models";
import { createError } from "@/utils/ApiError";
import { createResponse } from "@/utils/ApiResponse";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function POST(request: Request) {
    await connect();

    try {
        const { category, amount, title, description } = await request.json();

        const friendId = request.url.split("ask-money-from-friend/")[1];

        const { has, sessionClaims } = auth();
        const userId = (sessionClaims?.mongoId as { mongoId: string })?.mongoId;

        const mongoId = new mongoose.Types.ObjectId(userId);

        if (!has) {
            return Response.json(createError("Unauthorized", 401, false));
        }

        if (!userId || !mongoose.isValidObjectId(userId) || !friendId || !mongoose.isValidObjectId(friendId)) {
            return Response.json(createError("Invalid user ID or friendId", 400, false));
        }

        if (!(category || amount || title)) {
            return Response.json(createError("Invalid category, amount or title", 400, false));
        }

        if (parseInt(amount) <= 0) {
            return Response.json(createError("Invalid amount", 400, false));
        }

        if (description && description.length > 200) {
            return Response.json(createError("Description too long", 400, false));
        }

        const friend = new mongoose.Types.ObjectId(friendId);

        if (mongoId.equals(friend)) {
            return Response.json(createError("You cannot request money to yourself", 400, false));
        }

        // Create an Owe record
        const owe = await Owe.create({
            debtor: friendId,
            creditor: userId,
            category,
            amount,
            title,
            description,
        });

        if (!owe) {
            return Response.json(createError("Failed to send request! Please try again", 500, false));
        }

        const transaction = await Transaction.create({
            debtor: friendId,
            creditor: userId,
            category,
            amount,
            title,
            description: `Requested ${amount} ${category.toLowerCase()} from ${friendId} for ${title}`
        });

        if (!transaction) {
            return Response.json(createError("Failed to send request! Please try again", 500, false));
        }

        return Response.json(createResponse("Request sent successfully", 201, true, owe));
    } catch (error) {
        console.log(error);
        return Response.json(createError("Internal server error", 500, false));
    }
}