import { connect } from "@/lib/db";
import { Owe } from "@/models/owe.models";
import { createError } from "@/utils/ApiError";
import { createResponse } from "@/utils/ApiResponse";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

// The API route getMoneyFromUser retrieves the pending money amounts that others owe to the authenticated user.
// It fetches the transactions where the user is the creditor and filters them based on whether they are paid or unpaid.

export async function GET(request: Request) {
    await connect();

    try {
        const { has, sessionClaims } = auth();
        const userId = (sessionClaims?.mongoId as { mongoId: string })?.mongoId;

        if (!has) {
            return Response.json(createError("Unauthorized", 401, false));
        }

        if (!userId || !mongoose.isValidObjectId(userId)) {
            return Response.json(createError("Invalid user ID", 400, false));
        }

        const pipeline = [
            {
                $match: {
                    creditor: new mongoose.Types.ObjectId(userId),
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "debtor",
                    foreignField: "_id",
                    as: "debtorInfo",
                },
            },
            {
                $unwind: "$debtorInfo",
            },
            {
                $project: {
                    _id: 1,
                    amount: 1,
                    title: 1,
                    description: 1,
                    category: 1,
                    paid: 1,
                    debtorInfo: {
                        email: "$debtorInfo.email",
                        fullName: "$debtorInfo.fullName",
                        username: "$debtorInfo.username",
                        avatar: "$debtorInfo.avatar",
                    },
                },
            },
        ];

        const moneyOwedToUser = await Owe.aggregate(pipeline);

        if (!moneyOwedToUser) {
            return Response.json(createError("No money owed to user", 404, false));
        }

        return Response.json(createResponse(
            "Money owed to user found successfully", 200, true, moneyOwedToUser
        ));
    } catch (error) {
        console.log(error);
        return Response.json(createError("Internal server error", 500, false));
    }
}
