const { App } = require("@slack/bolt");
const fs = require("fs");
const cron = require("node-cron");
require("dotenv").config();

let rawFaqs = fs.readFileSync("db.json");
let faqs = JSON.parse(rawFaqs);

let rawSkillModal = fs.readFileSync("skill-modal.json");
let skillModal = JSON.parse(rawSkillModal);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.APP_TOKEN,
});

app.command("/skills", async ({ command, ack, say }) => {
  try {
    await ack();
    say("Yaaay! that command works!");
  } catch (error) {
    console.log("err");
    console.error(error);
  }
});

app.command("/knowledge", async ({ command, ack, say }) => {
  try {
    await ack();
    let message = { blocks: [] };
    faqs.data.map((faq) => {
      message.blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Question*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: faq.question,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Answer*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: faq.answer,
          },
        }
      );
    });
    say(message);
  } catch (error) {
    console.log("err");
    console.error(error);
  }
});

// Opens up a modal using the supplied JSON schema.
app.command(
  "/update-skills",
  async ({ command, ack, body, client, context, payload }) => {
    await ack();

    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: skillModal,
    });
  }
);

// On submit of the update-skills modal logs out all collected values
app.view("SKILL_MODAL", async ({ payload, context, client }) => {
  const values = await payload.state.values;

  const user = await client.users.info({
    user: context.userId,
  });

  const valueData = {
    userId: context.userId, // Include the user's username
    userName: user.user.real_name, // User's actual name
  };

  for (const blockId in values) {
    const inputType = values[blockId][Object.keys(values[blockId])[0]].type;

    if (inputType === "multi_static_select") {
      const selectedOptions =
        values[blockId][Object.keys(values[blockId])[0]].selected_options;
      valueData["values"] = selectedOptions.map((option) => option.value);
    } else if (inputType === "plain_text_input") {
      const inputValue = values[blockId][Object.keys(values[blockId])[0]].value;
      valueData["other"] = inputValue;
    }
  }

  // Instead of console logging, you can send the values to the database or wherever needed
  console.log("Collected values: " + JSON.stringify(valueData, null, 2));
});

const sendPeriodicUpdateReminder = async (client) => {
  try {
    // Get a list of all users in the workspace
    const { members } = await client.users.list();

    // Iterate through each user and send the reminder message
    for (const member of members) {
      if (!member.is_bot && !member.deleted) {
        await client.chat.postMessage({
          channel: member.id,
          text: "🌟 It's time to update your skills! Use the /update-skills command to add new skills.",
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
};

// Schedule the periodic update reminder every 6 months
// cron.schedule("0 0 1 */6 *", async () => {
//   const { client } = app;
//   await sendPeriodicUpdateReminder(client);
// });

// Schedule the periodic update reminder every day at 11am
cron.schedule("0 11 * * *", async () => {
  const { client } = app;
  await sendPeriodicUpdateReminder(client);
});

(async () => {
  await app.start(process.env.PORT || 3000);

  console.log(
    `⚡️ Skills Marketplace Bot is running on port ${process.env.PORT || 3000}!`
  );
})();
