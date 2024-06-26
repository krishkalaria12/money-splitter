import { connect } from "@/lib/db";
import { Owe } from "@/models/owe.models";
import { Transaction } from "@/models/transaction.models";
import { createError } from "@/utils/ApiError";
import { createResponse } from "@/utils/ApiResponse";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function DELETE(request: Request) {
    await connect();

    try {
        const oweId = request.url.split("delete-owe/")[1];

        const { has, sessionClaims } = auth();
        const userId = (sessionClaims?.mongoId as { mongoId: string })?.mongoId;

        if (!has) {
            throw createError("Unauthorized", 401, false);
        }

        if (!userId || !mongoose.isValidObjectId(userId) || !oweId || !mongoose.isValidObjectId(oweId)) {
            throw createError("Invalid user ID or OweId", 400, false);
        }

        const mongoId = new mongoose.Types.ObjectId(userId);

        const owe = await Owe.findById(oweId);

        if (!owe) {
            throw createError("Owe does not exist", 404, false);
        }

        if (!mongoId.equals(owe?.creditor)) {
            throw createError("Unauthorized to delete owe", 401, false);
        }

        // Delete the transaction associated with the owe
        const transaction = await Transaction.findOne({ oweId });
        if (transaction) {
            await Transaction.findByIdAndDelete(transaction._id);
        }

        // Delete the owe
        const deletedOwe = await Owe.findByIdAndDelete(oweId);

        if (!deletedOwe) {
            throw createError("Owe does not exist", 404, false);
        }

        return Response.json(createResponse("Owe and associated transaction deleted successfully", 200, true));
    } catch (error) {
        console.log("Error while deleting owe", error);
        throw createError("Internal server error", 500, false);
    }
}
