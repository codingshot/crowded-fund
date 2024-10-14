/* eslint-disable */

// add pause logic and new contract logic

import { expect } from "chai";
import { ethers } from "hardhat";
import { Campaigns } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Log } from "@ethersproject/abstract-provider";

// Add these interfaces to type the event args
interface CampaignCreatedEvent {
  campaignId: bigint;
}

interface DonationMadeEvent {
  campaignId: bigint;
  donationId: bigint;
  donor: string;
  amount: bigint;
}

describe("Campaigns", function () {
  let campaigns: Campaigns;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let protocolFeeRecipient: SignerWithAddress;

  const protocolFeeBasisPoints = 250; // 2.5%
  const defaultReferralFeeBasisPoints = 100; // 1%
  const defaultCreatorFeeBasisPoints = 500; // 5%

  before(async () => {
    [owner, user1, user2, user3, protocolFeeRecipient] = await ethers.getSigners();
    const campaignsFactory = await ethers.getContractFactory("Campaigns");
    campaigns = (await campaignsFactory.deploy(
      protocolFeeBasisPoints,
      protocolFeeRecipient.address,
      defaultReferralFeeBasisPoints,
      defaultCreatorFeeBasisPoints
    )) as Campaigns;
    await campaigns.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should have the right message on deploy", async function () {
      expect(await campaigns.greeting()).to.equal("Building Unstoppable Apps!!!");
    });

    it("Should allow setting a new message", async function () {
      const newGreeting = "Learn Scaffold-ETH 2! :)";

      await campaigns.setGreeting(newGreeting);
      expect(await campaigns.greeting()).to.equal(newGreeting);
    });
  });

  describe("Campaign Creation and Management", function () {
    const campaignName = "Test Campaign";
    const campaignDescription = "This is a test campaign";
    const coverImageUrl = "https://example.com/image.jpg";
    const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const endTime = startTime + 86400; // 1 day after start
    const targetAmount = ethers.parseEther("10");
    const minAmount = ethers.parseEther("5");
    const maxAmount = ethers.parseEther("15");
    const referralFeeBasisPoints = 200; // 2%
    const creatorFeeBasisPoints = 300; // 3%
    const secret = ethers.id("secret");

    let campaignId: bigint;

    it("Should create a campaign commitment", async function () {
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          [campaignName, campaignDescription, coverImageUrl, user1.address, startTime, endTime, ethers.ZeroAddress, targetAmount, minAmount, maxAmount, referralFeeBasisPoints, creatorFeeBasisPoints, secret]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(event, "Event should exist").to.not.be.undefined;
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;
    });

    it("Should reveal the campaign", async function () {
      await campaigns.revealCampaign(
        campaignId,
        campaignName,
        campaignDescription,
        coverImageUrl,
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        targetAmount,
        minAmount,
        maxAmount,
        referralFeeBasisPoints,
        creatorFeeBasisPoints,
        secret
      );

      const campaign = await campaigns.getCampaign(campaignId);
      expect(campaign.name).to.equal(campaignName);
      expect(campaign.owner).to.equal(owner.address);
    });

    it("Should update the campaign", async function () {
      const newName = "Updated Campaign";
      const newDescription = "This is an updated description";
      const newCoverImageUrl = "https://example.com/new-image.jpg";
      const newStartTime = startTime + 1800; // 30 minutes later
      const newEndTime = endTime + 86400; // 1 day later
      const newTargetAmount = ethers.parseEther("12");
      const newMaxAmount = ethers.parseEther("18");

      await campaigns.updateCampaign(
        campaignId,
        newName,
        newDescription,
        newCoverImageUrl,
        newStartTime,
        newEndTime,
        newTargetAmount,
        newMaxAmount
      );

      const updatedCampaign = await campaigns.getCampaign(campaignId);
      expect(updatedCampaign.name).to.equal(newName);
      expect(updatedCampaign.description).to.equal(newDescription);
      expect(updatedCampaign.coverImageUrl).to.equal(newCoverImageUrl);
      expect(updatedCampaign.startTime).to.equal(newStartTime);
      expect(updatedCampaign.endTime).to.equal(newEndTime);
      expect(updatedCampaign.targetAmount).to.equal(newTargetAmount);
      expect(updatedCampaign.maxAmount).to.equal(newMaxAmount);
    });
  });

  describe("Donations", function () {
    let campaignId: bigint;

    before(async function () {
      // Create a new campaign for donation tests
      const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
      const endTime = startTime + 86400; // 1 day duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["Donation Test", "Test for donations", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 200, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "Donation Test",
        "Test for donations",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        200,
        300,
        ethers.id("secret")
      );

      // Wait for the campaign to start
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);
    });

    it("Should allow donations", async function () {
      const donationAmount = ethers.parseEther("1");
      const tx = await campaigns.connect(user2).donate(campaignId, "Good luck!", ethers.ZeroAddress, { value: donationAmount });
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('DonationMade'));
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(event, "Event should exist").to.not.be.undefined;
      const decodedEvent = campaigns.interface.decodeEventLog('DonationMade', event!.data, event!.topics) as DonationMadeEvent;
      expect(decodedEvent.donor).to.equal(user2.address);
      expect(decodedEvent.amount).to.equal(donationAmount);
    });

    it("Should process escrowed donations when minimum is reached", async function () {
      // Make more donations to reach the minimum
      await campaigns.connect(user2).donate(campaignId, "Reaching minimum", ethers.ZeroAddress, { value: ethers.parseEther("4") });
      
      const tx = await campaigns.processEscrowedDonations(campaignId);
      const receipt = await tx.wait(); // Wait for the transaction to be mined
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(receipt.status, "Transaction should be successful").to.equal(1);
      // Check for relevant events or state changes
      expect(await campaigns.getCampaignTotalDonations(campaignId)).to.be.gte(ethers.parseEther("5"));
    });

    it("Should not allow donations after end time", async function () {
      // Increase time to after campaign end
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await expect(campaigns.connect(user2).donate(campaignId, "Too late", ethers.ZeroAddress, { value: ethers.parseEther("1") }))
        .to.be.revertedWith("Campaign has ended");
    });
  });

  describe("Refunds", function () {
    let campaignId: bigint;

    before(async function () {
      // Create a new campaign for refund tests
      const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
      const endTime = startTime + 3600; // 1 hour duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["Refund Test", "Test for refunds", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 200, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "Refund Test",
        "Test for refunds",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        200,
        300,
        ethers.id("secret")
      );

      // Wait for the campaign to start
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      // Make a donation
      await campaigns.connect(user2).donate(campaignId, "Refund test", ethers.ZeroAddress, { value: ethers.parseEther("1") });

      // End the campaign
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
    });

    it("Should allow refund claims", async function () {
      const balanceBefore = await ethers.provider.getBalance(user2.address);
      const tx = await campaigns.connect(user2).claimRefund(1); // Assuming donation ID is 1
      const receipt = await tx.wait(); // Wait for the transaction to be mined
      expect(receipt.status).to.equal(1); // Check if the transaction was successful
      const balanceAfter = await ethers.provider.getBalance(user2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should not allow double refund claims", async function () {
      await expect(campaigns.connect(user2).claimRefund(1))
        .to.be.revertedWith("Refund already claimed");
    });
  });

  describe("Admin Functions", function () {
    it("Should update protocol fee basis points", async function () {
      const newProtocolFee = 300; // 3%
      await campaigns.connect(owner).updateProtocolFeeBasisPoints(newProtocolFee);
      expect(await campaigns.protocolFeeBasisPoints()).to.equal(newProtocolFee);
    });

    it("Should update protocol fee recipient", async function () {
      const newRecipient = user2.address;
      await campaigns.connect(owner).updateProtocolFeeRecipient(newRecipient);
      expect(await campaigns.protocolFeeRecipient()).to.equal(newRecipient);
    });

    it("Should not allow non-owners to update protocol fee", async function () {
      await expect(campaigns.connect(user1).updateProtocolFeeBasisPoints(400))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Edge Cases and Attack Vectors", function () {
    let campaignId: bigint;

    before(async function () {
      // Create a new campaign for edge case tests
      const startTime = await time.latest() + 60; // Start in 1 minute
      const endTime = startTime + 86400; // 1 day duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["Edge Case Test", "Test for edge cases", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 200, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "Edge Case Test",
        "Test for edge cases",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        200,
        300,
        ethers.id("secret")
      );

      // Wait for the campaign to start
      await time.increase(61);
    });

    it("Should not allow donations exceeding max amount", async function () {
      await expect(campaigns.connect(user2).donate(campaignId, "Exceeding max", ethers.ZeroAddress, { value: ethers.parseEther("16") }))
        .to.be.revertedWith("Exceeds campaign max amount");
    });

    it("Should not allow updating campaign after it has started", async function () {
      await expect(campaigns.updateCampaign(campaignId, "New Name", "", "", 0, 0, 0, 0))
        .to.be.revertedWith("Cannot update after campaign has started");
    });

    it("Should not allow non-owner to delete campaign", async function () {
      await expect(campaigns.connect(user2).deleteCampaign(campaignId))
        .to.be.revertedWith("Not authorized");
    });

    it("Should not allow deleting campaign after it has started", async function () {
      await expect(campaigns.connect(owner).deleteCampaign(campaignId))
        .to.be.revertedWith("Campaign has already started");
    });

    it("Should not allow revealing campaign with incorrect commitment", async function () {
      const newCampaignId = await campaigns.createCampaignCommitment(ethers.id("wrong_commitment"));
      await expect(campaigns.revealCampaign(
        newCampaignId,
        "Wrong Commitment",
        "This should fail",
        "https://example.com/wrong.jpg",
        user1.address,
        await time.latest() + 3600,
        await time.latest() + 86400,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        200,
        300,
        ethers.id("wrong_secret")
      )).to.be.revertedWith("Invalid commitment");
    });
  });

  describe("Campaigns Not Meeting Threshold", function () {
    let campaignId: bigint;

    before(async function () {
      // Create a new campaign with a high threshold
      const startTime = await time.latest() + 60;
      const endTime = startTime + 3600; // 1 hour duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["High Threshold", "Test for not meeting threshold", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("100"), ethers.parseEther("50"), ethers.parseEther("150"), 200, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "High Threshold",
        "Test for not meeting threshold",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("100"),
        ethers.parseEther("50"),
        ethers.parseEther("150"),
        200,
        300,
        ethers.id("secret")
      );

      // Wait for the campaign to start
      await time.increase(61);

      // Make some donations, but not enough to meet the threshold
      await campaigns.connect(user2).donate(campaignId, "Donation 1", ethers.ZeroAddress, { value: ethers.parseEther("20") });
      await campaigns.connect(user3).donate(campaignId, "Donation 2", ethers.ZeroAddress, { value: ethers.parseEther("25") });

      // End the campaign
      await time.increase(3601);
    });

    it("Should not allow processing escrowed donations when threshold not met", async function () {
      await expect(campaigns.processEscrowedDonations(campaignId))
        .to.be.revertedWith("Minimum amount not reached");
    });

    it("Should allow refunds when threshold not met", async function () {
      const balanceBefore = await ethers.provider.getBalance(user2.address);
      await campaigns.connect(user2).claimRefund(1); // Assuming donation ID is 1
      const balanceAfter = await ethers.provider.getBalance(user2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should allow claiming all refunds", async function () {
      const tx = await campaigns.connect(owner).claimAllRefunds(campaignId);
      const receipt = await tx.wait(); // Wait for the transaction to be mined
      const events = receipt.logs.filter((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('RefundClaimed'));
      expect(events.length).to.satisfy((length: number) => length > 0, "At least one refund should be claimed");
    });
  });

  describe("Referral Fees and Changes", function () {
    let campaignId: bigint;

    before(async function () {
      // Create a new campaign for referral tests
      const startTime = await time.latest() + 60;
      const endTime = startTime + 86400; // 1 day duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["Referral Test", "Test for referrals", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 500, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "Referral Test",
        "Test for referrals",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        500, // 5% referral fee
        300,
        ethers.id("secret")
      );

      // Wait for the campaign to start
      await time.increase(61);
    });

    it("Should correctly apply referral fee", async function () {
      const donationAmount = ethers.parseEther("1");
      const referrerBalanceBefore = await ethers.provider.getBalance(user3.address);
      
      await campaigns.connect(user2).donate(campaignId, "Referral donation", user3.address, { value: donationAmount });
      
      const referrerBalanceAfter = await ethers.provider.getBalance(user3.address);
      const expectedReferralFee = donationAmount * BigInt(500) / BigInt(10000); // 5% of 1 ETH
      expect(referrerBalanceAfter - referrerBalanceBefore).to.equal(expectedReferralFee);
    });

    it("Should update default referral fee", async function () {
      const newDefaultReferralFee = 300; // 3%
      await campaigns.connect(owner).updateDefaultReferralFeeBasisPoints(newDefaultReferralFee);
      expect(await campaigns.defaultReferralFeeBasisPoints()).to.equal(newDefaultReferralFee);
    });

    it("Should use updated default referral fee for new campaigns", async function () {
      const startTime = await time.latest() + 60;
      const endTime = startTime + 86400;
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["New Referral Test", "Test for new referral fee", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 0, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      const newCampaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        newCampaignId,
        "New Referral Test",
        "Test for new referral fee",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        0, // Use default referral fee
        300,
        ethers.id("secret")
      );

      const campaign = await campaigns.getCampaign(newCampaignId);
      expect(campaign.referralFeeBasisPoints).to.equal(300); // Should use the new default
    });
  });

  describe("Double Claim Prevention", function () {
    let campaignId: bigint;
    let donationId: bigint;

    before(async function () {
      // Create a new campaign for double claim tests
      const startTime = await time.latest() + 60;
      const endTime = startTime + 3600; // 1 hour duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["Double Claim Test", "Test for double claims", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 200, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "Double Claim Test",
        "Test for double claims",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        200,
        300,
        ethers.id("secret")
      );

      // Wait for the campaign to start
      await time.increase(61);

      // Make a donation
      const donateTx = await campaigns.connect(user2).donate(campaignId, "Double claim test", ethers.ZeroAddress, { value: ethers.parseEther("1") });
      const donateReceipt = await donateTx.wait();
      const donationEvent = donateReceipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('DonationMade'));
      const decodedDonationEvent = campaigns.interface.decodeEventLog('DonationMade', donationEvent!.data, donationEvent!.topics) as DonationMadeEvent;
      donationId = decodedDonationEvent.donationId;

      // End the campaign without reaching the goal
      await time.increase(3601);
    });

    it("Should allow first refund claim", async function () {
      await campaigns.connect(user2).claimRefund(donationId);
      const donation = await campaigns.getDonation(donationId);
      expect(donation.refundClaimed).to.be.true;
    });

    it("Should prevent double refund claims", async function () {
      await expect(
        campaigns.connect(user2).claimRefund(donationId)
      ).to.be.rejectedWith("Refund already claimed");
    });

    it("Should not allow refund claim after successful campaign", async function () {
      // Create a new campaign that reaches its goal
      const startTime = await time.latest() + 60;
      const endTime = startTime + 3600;
      const newCampaignId = await createTestCampaign(startTime, endTime, ethers.parseEther("5"), ethers.parseEther("3"), ethers.parseEther("10"));

      // Make donations to reach the goal
      await campaigns.connect(user2).donate(newCampaignId, "Donation 1", ethers.ZeroAddress, { value: ethers.parseEther("2") });
      await campaigns.connect(user3).donate(newCampaignId, "Donation 2", ethers.ZeroAddress, { value: ethers.parseEther("2") });

      // Process escrowed donations
      await campaigns.processEscrowedDonations(newCampaignId);

      // Try to claim refund
      await expect(
        campaigns.connect(user2).claimRefund(newCampaignId)
      ).to.be.rejectedWith("Refunds not available for successful campaigns");
    });
  });

  describe("Gas Limit and Large Scale Operations", function () {
    it("Should handle claiming all refunds for a large number of donations", async function () {
      const startTime = await time.latest() + 60;
      const endTime = startTime + 3600;
      const campaignId = await createTestCampaign(startTime, endTime, ethers.parseEther("1000"), ethers.parseEther("500"), ethers.parseEther("2000"));

      // Make a large number of small donations
      for (let i = 0; i < 100; i++) {
        await campaigns.connect(user2).donate(campaignId, `Donation ${i}`, ethers.ZeroAddress, { value: ethers.parseEther("0.1") });
      }

      // End the campaign without reaching the goal
      await time.increase(3601);

      // Claim all refunds
      const tx = await campaigns.claimAllRefunds(campaignId);
      const receipt = await tx.wait(); // Wait for the transaction to be mined
      console.log(`Gas used for claiming all refunds: ${receipt.gasUsed}`);
      
      // Check if the transaction was successful
      expect(receipt.status).to.equal(1, "Transaction should be successful");

      // Check if all donations were refunded
      const campaign = await campaigns.getCampaign(campaignId);
      expect(campaign.totalDonations).to.equal(BigInt(0), "All donations should be refunded");
    });
  });

  describe("Official Campaign Status", function () {
    let campaignId: bigint;

    before(async function () {
      // Create a new campaign for official status tests
      const startTime = await time.latest() + 60;
      const endTime = startTime + 86400; // 1 day duration
      const commitmentHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
          ["Official Test", "Test for official status", "https://example.com/image.jpg", user1.address, startTime, endTime, ethers.ZeroAddress, ethers.parseEther("10"), ethers.parseEther("5"), ethers.parseEther("15"), 200, 300, ethers.id("secret")]
        )
      );

      const tx = await campaigns.createCampaignCommitment(commitmentHash);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
      const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
      campaignId = decodedEvent.campaignId;

      await campaigns.revealCampaign(
        campaignId,
        "Official Test",
        "Test for official status",
        "https://example.com/image.jpg",
        user1.address,
        startTime,
        endTime,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        200,
        300,
        ethers.id("secret")
      );
    });

    it("Should set isOfficial to true if recipient is owner", async function () {
      const ownerCampaignId = await createTestCampaign(
        await time.latest() + 60,
        await time.latest() + 86460,
        ethers.parseEther("10"),
        ethers.parseEther("5"),
        ethers.parseEther("15"),
        owner.address // Set owner as recipient
      );

      const campaign = await campaigns.getCampaign(ownerCampaignId);
      expect(campaign.isOfficial).to.be.true;
    });

    it("Should allow recipient to update official status", async function () {
      await campaigns.connect(user1).setOfficialStatus(campaignId, true);
      let campaign = await campaigns.getCampaign(campaignId);
      expect(campaign.isOfficial).to.be.true;

      await campaigns.connect(user1).setOfficialStatus(campaignId, false);
      campaign = await campaigns.getCampaign(campaignId);
      expect(campaign.isOfficial).to.be.false;
    });

    it("Should not allow non-recipient to update official status", async function () {
      await expect(campaigns.connect(user2).setOfficialStatus(campaignId, true))
        .to.be.revertedWith("Only recipient can update official status");
    });

    it("Should correctly report official status", async function () {
      await campaigns.connect(user1).setOfficialStatus(campaignId, true);
      expect(await campaigns.isOfficialCampaign(campaignId)).to.be.true;

      await campaigns.connect(user1).setOfficialStatus(campaignId, false);
      expect(await campaigns.isOfficialCampaign(campaignId)).to.be.false;
    });
  });

  // Helper function to create a test campaign
  async function createTestCampaign(
    startTime: number,
    endTime: number,
    targetAmount: bigint,
    minAmount: bigint,
    maxAmount: bigint,
    recipient: string = user1.address // Default to user1 if not specified
  ): Promise<bigint> {
    const commitmentHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "string", "address", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
        ["Test Campaign", "Test description", "https://example.com/image.jpg", recipient, startTime, endTime, ethers.ZeroAddress, targetAmount, minAmount, maxAmount, 200, 300, ethers.id("secret")]
      )
    );

    const tx = await campaigns.createCampaignCommitment(commitmentHash);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: Log) => log.topics[0] === campaigns.interface.getEventTopic('CampaignCreated'));
    const decodedEvent = campaigns.interface.decodeEventLog('CampaignCreated', event!.data, event!.topics) as CampaignCreatedEvent;
    const campaignId = decodedEvent.campaignId;

    await campaigns.revealCampaign(
      campaignId,
      "Test Campaign",
      "Test description",
      "https://example.com/image.jpg",
      recipient,
      startTime,
      endTime,
      ethers.ZeroAddress,
      targetAmount,
      minAmount,
      maxAmount,
      200,
      300,
      ethers.id("secret")
    );

    return campaignId;
  }
});