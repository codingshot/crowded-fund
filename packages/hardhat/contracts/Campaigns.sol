// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title Campaigns
 * @dev A contract for managing fundraising campaigns on Ethereum with optional refund based targets for donors
 */
contract Campaigns is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Struct definitions
    struct Campaign {
        address owner;
        string name;
        string description;
        string coverImageUrl;
        address payable recipient;
        uint256 startTime;
        uint256 endTime;
        uint256 createdTime;
        address ftAddress; // ERC20 token address, address(0) for ETH
        uint256 targetAmount;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 totalRaisedAmount;
        uint256 netRaisedAmount;
        uint256 escrowBalance;
        uint256 referralFeeBasisPoints;
        uint256 creatorFeeBasisPoints;
        bool isOfficial;
        // Removed allowFeeAvoidance to prevent fee avoidance exploitation
    }

    struct Donation {
        uint256 campaignId;
        address donor;
        uint256 totalAmount;
        uint256 netAmount;
        string message;
        uint256 donatedTime;
        uint256 protocolFee;
        address referrer;
        uint256 referrerFee;
        uint256 creatorFee;
        uint256 returnedTime;
        bool refundClaimed; // Added to support pull-based refunds
    }

    // State variables
    uint256 public nextCampaignId;
    uint256 public nextDonationId;
    uint256 public protocolFeeBasisPoints;
    address public protocolFeeRecipient;
    uint256 public defaultReferralFeeBasisPoints;
    uint256 public defaultCreatorFeeBasisPoints;
    uint256 public constant MAX_BASIS_POINTS = 10000;
    uint256 public constant MAX_TIME_EXTENSION = 7 days; // Maximum allowed time extension for campaigns

    // Mappings
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Donation) public donations;
    mapping(address => uint256[]) public campaignsByOwner;
    mapping(address => uint256[]) public campaignsByRecipient;
    mapping(uint256 => uint256[]) public donationsByCampaign;
    mapping(address => uint256[]) public donationsByDonor;

    // Events
    event CampaignCreated(uint256 indexed campaignId, address indexed owner, string name, bytes32 commitmentHash);
    event CampaignUpdated(uint256 indexed campaignId);
    event DonationMade(uint256 indexed campaignId, uint256 indexed donationId, address indexed donor, uint256 amount);
    event CampaignDeleted(uint256 indexed campaignId);
    event RefundClaimed(uint256 indexed campaignId, uint256 indexed donationId, address indexed donor, uint256 amount);

    /**
     * @dev Constructor to initialize the Campaigns contract
     * @param _protocolFeeBasisPoints The protocol fee in basis points
     * @param _protocolFeeRecipient The address to receive protocol fees
     * @param _defaultReferralFeeBasisPoints The default referral fee in basis points
     * @param _defaultCreatorFeeBasisPoints The default creator fee in basis points
     */
    constructor(
        uint256 _protocolFeeBasisPoints,
        address _protocolFeeRecipient,
        uint256 _defaultReferralFeeBasisPoints,
        uint256 _defaultCreatorFeeBasisPoints
    ) {
        require(_protocolFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid protocol fee");
        require(_defaultReferralFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid referral fee");
        require(_defaultCreatorFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid creator fee");

        protocolFeeBasisPoints = _protocolFeeBasisPoints;
        protocolFeeRecipient = _protocolFeeRecipient;
        defaultReferralFeeBasisPoints = _defaultReferralFeeBasisPoints;
        defaultCreatorFeeBasisPoints = _defaultCreatorFeeBasisPoints;

        nextCampaignId = 1;
        nextDonationId = 1;
    }

    /**
     * @dev Create a new campaign using a commit-reveal scheme
     * @param _commitmentHash Hash of campaign details and a secret
     * @return campaignId The ID of the created campaign
     */
    function createCampaignCommitment(bytes32 _commitmentHash) external returns (uint256) {
        uint256 campaignId = nextCampaignId++;
        
        // Store the commitment hash temporarily
        campaigns[campaignId].description = bytes32ToStr(_commitmentHash);
        
        emit CampaignCreated(campaignId, msg.sender, "", _commitmentHash);
        
        return campaignId;
    }

    /**
     * @dev Reveal the campaign details after commitment
     * @param _campaignId The ID of the campaign to reveal
     * @param _name Campaign name
     * @param _description Campaign description
     * @param _coverImageUrl Cover image URL
     * @param _recipient Recipient address
     * @param _startTime Start time of the campaign
     * @param _endTime End time of the campaign (0 for no end time)
     * @param _ftAddress ERC20 token address (address(0) for ETH)
     * @param _targetAmount Target amount for the campaign
     * @param _minAmount Minimum amount to be raised (0 for no minimum)
     * @param _maxAmount Maximum amount to be raised (0 for no maximum)
     * @param _referralFeeBasisPoints Referral fee in basis points
     * @param _creatorFeeBasisPoints Creator fee in basis points
     * @param _secret The secret used in the commitment hash
     */
    function revealCampaign(
        uint256 _campaignId,
        string memory _name,
        string memory _description,
        string memory _coverImageUrl,
        address payable _recipient,
        uint256 _startTime,
        uint256 _endTime,
        address _ftAddress,
        uint256 _targetAmount,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _referralFeeBasisPoints,
        uint256 _creatorFeeBasisPoints,
        bytes32 _secret
    ) external {
        Campaign storage campaign = campaigns[_campaignId];
        
        // Verify the commitment
        bytes32 commitmentHash = keccak256(abi.encodePacked(
            _name, _description, _coverImageUrl, _recipient, _startTime, _endTime,
            _ftAddress, _targetAmount, _minAmount, _maxAmount, _referralFeeBasisPoints,
            _creatorFeeBasisPoints, _secret
        ));
        require(bytes32ToStr(commitmentHash) == campaign.description, "Invalid commitment");
        
        // Perform the usual checks
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime == 0 || _endTime > _startTime, "End time must be after start time");
        require(_targetAmount > 0, "Target amount must be greater than 0");
        require(_maxAmount == 0 || _maxAmount >= _minAmount, "Max amount must be greater than or equal to min amount");
        require(_referralFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid referral fee");
        require(_creatorFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid creator fee");

        // Set the campaign details
        campaign.owner = msg.sender;
        campaign.name = _name;
        campaign.description = _description;
        campaign.coverImageUrl = _coverImageUrl;
        campaign.recipient = _recipient;
        campaign.startTime = _startTime;
        campaign.endTime = _endTime;
        campaign.createdTime = block.timestamp;
        campaign.ftAddress = _ftAddress;
        campaign.targetAmount = _targetAmount;
        campaign.minAmount = _minAmount;
        campaign.maxAmount = _maxAmount;
        campaign.referralFeeBasisPoints = _referralFeeBasisPoints;
        campaign.creatorFeeBasisPoints = _creatorFeeBasisPoints;
        campaign.isOfficial = (msg.sender == _recipient);

        campaignsByOwner[msg.sender].push(_campaignId);
        campaignsByRecipient[_recipient].push(_campaignId);

        emit CampaignCreated(_campaignId, msg.sender, _name, commitmentHash);
    }

    /**
     * @dev Update an existing campaign
     * @param _campaignId Campaign ID to update
     * @param _name New campaign name (empty string to keep current)
     * @param _description New campaign description (empty string to keep current)
     * @param _coverImageUrl New cover image URL (empty string to keep current)
     * @param _startTime New start time (0 to keep current)
     * @param _endTime New end time (0 to keep current)
     * @param _targetAmount New target amount (0 to keep current)
     * @param _maxAmount New maximum amount (0 to keep current)
     */
    function updateCampaign(
        uint256 _campaignId,
        string memory _name,
        string memory _description,
        string memory _coverImageUrl,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _targetAmount,
        uint256 _maxAmount
    ) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.owner, "Only campaign owner can update");
        require(block.timestamp < campaign.startTime, "Cannot update after campaign has started");

        if (bytes(_name).length > 0) {
            campaign.name = _name;
        }
        if (bytes(_description).length > 0) {
            campaign.description = _description;
        }
        if (bytes(_coverImageUrl).length > 0) {
            campaign.coverImageUrl = _coverImageUrl;
        }
        if (_startTime > 0) {
            require(_startTime > block.timestamp, "Start time must be in the future");
            campaign.startTime = _startTime;
        }
        if (_endTime > 0) {
            require(_endTime > campaign.startTime, "End time must be after start time");
            // Limit the extension of end time
            require(_endTime <= campaign.endTime.add(MAX_TIME_EXTENSION), "Cannot extend end time by more than 7 days");
            campaign.endTime = _endTime;
        }
        if (_targetAmount > 0) {
            campaign.targetAmount = _targetAmount;
        }
        if (_maxAmount > 0) {
            require(_maxAmount >= campaign.minAmount, "Max amount must be greater than or equal to min amount");
            campaign.maxAmount = _maxAmount;
        }

        emit CampaignUpdated(_campaignId);
    }

    /**
     * @dev Make a donation to a campaign
     * @param _campaignId Campaign ID to donate to
     * @param _message Optional message from the donor
     * @param _referrer Address of the referrer (if any)
     */
    function donate(
        uint256 _campaignId,
        string memory _message,
        address _referrer
    ) external payable nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.startTime, "Campaign has not started");
        require(campaign.endTime == 0 || block.timestamp <= campaign.endTime, "Campaign has ended");
        require(campaign.maxAmount == 0 || campaign.totalRaisedAmount.add(msg.value) <= campaign.maxAmount, "Exceeds campaign max amount");

        uint256 protocolFee = calculateFee(msg.value, protocolFeeBasisPoints);
        uint256 creatorFee = calculateFee(msg.value, campaign.creatorFeeBasisPoints);
        uint256 referrerFee = _referrer != address(0) ? calculateFee(msg.value, campaign.referralFeeBasisPoints) : 0;

        uint256 netAmount = msg.value.sub(protocolFee).sub(creatorFee).sub(referrerFee);

        uint256 donationId = nextDonationId++;
        Donation storage donation = donations[donationId];
        donation.campaignId = _campaignId;
        donation.donor = msg.sender;
        donation.totalAmount = msg.value;
        donation.netAmount = netAmount;
        donation.message = _message;
        donation.donatedTime = block.timestamp;
        donation.protocolFee = protocolFee;
        donation.referrer = _referrer;
        donation.referrerFee = referrerFee;
        donation.creatorFee = creatorFee;

        campaign.totalRaisedAmount = campaign.totalRaisedAmount.add(msg.value);
        campaign.netRaisedAmount = campaign.netRaisedAmount.add(netAmount);

        if (campaign.minAmount > 0 && campaign.totalRaisedAmount < campaign.minAmount) {
            campaign.escrowBalance = campaign.escrowBalance.add(msg.value);
        } else {
            // Transfer funds immediately if min amount is reached or not set
            _transferFunds(campaign.recipient, netAmount);
            _transferFunds(payable(protocolFeeRecipient), protocolFee);
            _transferFunds(payable(campaign.owner), creatorFee);
            if (referrerFee > 0) {
                _transferFunds(payable(_referrer), referrerFee);
            }
        }

        donationsByCampaign[_campaignId].push(donationId);
        donationsByDonor[msg.sender].push(donationId);

        emit DonationMade(_campaignId, donationId, msg.sender, msg.value);
    }

    /**
     * @dev Process escrowed donations for a campaign
     * @param _campaignId Campaign ID to process donations for
     */
    function processEscrowedDonations(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.escrowBalance > 0, "No escrowed donations to process");
        require(campaign.totalRaisedAmount >= campaign.minAmount, "Minimum amount not reached");

        uint256 escrowBalance = campaign.escrowBalance;
        campaign.escrowBalance = 0;

        // Update state before making transfers
        campaign.netRaisedAmount = campaign.netRaisedAmount.add(escrowBalance);

        // Transfer funds
        _transferFunds(campaign.recipient, escrowBalance);

        // Process fees
        uint256[] memory campaignDonations = donationsByCampaign[_campaignId];
        for (uint256 i = 0; i < campaignDonations.length; i++) {
            Donation storage donation = donations[campaignDonations[i]];
            if (donation.protocolFee > 0) {
                _transferFunds(payable(protocolFeeRecipient), donation.protocolFee);
            }
            if (donation.creatorFee > 0) {
                _transferFunds(payable(campaign.owner), donation.creatorFee);
            }
            if (donation.referrerFee > 0) {
                _transferFunds(payable(donation.referrer), donation.referrerFee);
            }
        }
    }

    /**
     * @dev Claim refund for a donation
     * @param _donationId Donation ID to claim refund for
     */
    function claimRefund(uint256 _donationId) external nonReentrant {
        Donation storage donation = donations[_donationId];
        Campaign storage campaign = campaigns[donation.campaignId];
        
        require(campaign.endTime > 0 && block.timestamp > campaign.endTime, "Campaign has not ended");
        require(campaign.totalRaisedAmount < campaign.minAmount, "Minimum amount reached, cannot refund");
        require(!donation.refundClaimed, "Refund already claimed");

        donation.refundClaimed = true;
        _transferFunds(payable(donation.donor), donation.totalAmount);

        emit RefundClaimed(donation.campaignId, _donationId, donation.donor, donation.totalAmount);
    }

    /**
     * @dev Claim all refunds for a campaign
     * @param _campaignId Campaign ID to claim refunds for
     */
    function claimAllRefunds(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.endTime > 0 && block.timestamp > campaign.endTime, "Campaign has not ended");
        require(campaign.totalRaisedAmount < campaign.minAmount, "Minimum amount reached, cannot refund");

        uint256[] memory campaignDonations = donationsByCampaign[_campaignId];
        for (uint256 i = 0; i < campaignDonations.length; i++) {
            Donation storage donation = donations[campaignDonations[i]];
            if (!donation.refundClaimed) {
                donation.refundClaimed = true;
                _transferFunds(payable(donation.donor), donation.totalAmount);
                emit RefundClaimed(donation.campaignId, campaignDonations[i], donation.donor, donation.totalAmount);
            }
        }
    }

    /**
     * @dev Internal function to transfer funds
     * @param _recipient Recipient of the funds
     * @param _amount Amount to transfer
     */
    function _transferFunds(address payable _recipient, uint256 _amount) internal {
        (bool success, ) = _recipient.call{value: _amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Convert bytes32 to string
     * @param _bytes32 The bytes32 value to convert
     * @return The string representation of the bytes32 value
     */
    function bytes32ToStr(bytes32 _bytes32) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i; i < 32; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    /**
     * @dev Calculate fee based on amount and basis points
     * @param _amount Amount to calculate fee for
     * @param _basisPoints Fee percentage in basis points
     * @return Fee amount
     */
    function calculateFee(uint256 _amount, uint256 _basisPoints) internal pure returns (uint256) {
        return _amount.mul(_basisPoints).div(MAX_BASIS_POINTS);
    }

    /**
     * @dev Get campaign details
     * @param _campaignId Campaign ID
     * @return Campaign details
     */
    function getCampaign(uint256 _campaignId) external view returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    /**
     * @dev Get donation details
     * @param _donationId Donation ID
     * @return Donation details
     */
    function getDonation(uint256 _donationId) external view returns (Donation memory) {
        return donations[_donationId];
    }

    /**
     * @dev Get campaigns created by a specific owner
     * @param _owner Owner address
     * @return Array of campaign IDs
     */
    function getCampaignsByOwner(address _owner) external view returns (uint256[] memory) {
        return campaignsByOwner[_owner];
    }

    /**
     * @dev Get campaigns for a specific recipient
     * @param _recipient Recipient address
     * @return Array of campaign IDs
     */
    function getCampaignsByRecipient(address _recipient) external view returns (uint256[] memory) {
        return campaignsByRecipient[_recipient];
    }

    /**
     * @dev Get donations for a specific campaign
     * @param _campaignId Campaign ID
     * @return Array of donation IDs
     */
    function getDonationsByCampaign(uint256 _campaignId) external view returns (uint256[] memory) {
        return donationsByCampaign[_campaignId];
    }

    /**
     * @dev Get donations made by a specific donor
     * @param _donor Donor address
     * @return Array of donation IDs
     */
    function getDonationsByDonor(address _donor) external view returns (uint256[] memory) {
        return donationsByDonor[_donor];
    }

    /**
     * @dev Update protocol fee basis points
     * @param _protocolFeeBasisPoints New protocol fee basis points
     */
    function updateProtocolFeeBasisPoints(uint256 _protocolFeeBasisPoints) external onlyOwner {
        require(_protocolFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid protocol fee");
        protocolFeeBasisPoints = _protocolFeeBasisPoints;
    }

    /**
     * @dev Update protocol fee recipient
     * @param _protocolFeeRecipient New protocol fee recipient address
     */
    function updateProtocolFeeRecipient(address _protocolFeeRecipient) external onlyOwner {
        require(_protocolFeeRecipient != address(0), "Invalid protocol fee recipient");
        protocolFeeRecipient = _protocolFeeRecipient;
    }

    /**
     * @dev Update default referral fee basis points
     * @param _defaultReferralFeeBasisPoints New default referral fee basis points
     */
    function updateDefaultReferralFeeBasisPoints(uint256 _defaultReferralFeeBasisPoints) external onlyOwner {
        require(_defaultReferralFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid referral fee");
        defaultReferralFeeBasisPoints = _defaultReferralFeeBasisPoints;
    }

    /**
     * @dev Update default creator fee basis points
     * @param _defaultCreatorFeeBasisPoints New default creator fee basis points
     */
    function updateDefaultCreatorFeeBasisPoints(uint256 _defaultCreatorFeeBasisPoints) external onlyOwner {
        require(_defaultCreatorFeeBasisPoints <= MAX_BASIS_POINTS, "Invalid creator fee");
        defaultCreatorFeeBasisPoints = _defaultCreatorFeeBasisPoints;
    }

    /**
     * @dev Withdraw any stuck ETH in the contract (emergency function)
     * @param _amount Amount of ETH to withdraw
     */
    function withdrawStuckETH(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(_amount);
    }

    /**
     * @dev Withdraw any stuck ERC20 tokens in the contract (emergency function)
     * @param _token ERC20 token address
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawStuckERC20(address _token, uint256 _amount) external onlyOwner {
        IERC20 token = IERC20(_token);
        require(_amount <= token.balanceOf(address(this)), "Insufficient token balance");
        require(token.transfer(owner(), _amount), "Token transfer failed");
    }

    /**
     * @dev Delete a campaign
     * @param _campaignId Campaign ID to delete
     */
    function deleteCampaign(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.owner, "Not authorized");
        require(block.timestamp < campaign.startTime, "Campaign has already started");
        require(campaign.totalRaisedAmount == 0, "Campaign has received donations");

        // Remove campaign from owner's list
        _removeFromArray(campaignsByOwner[campaign.owner], _campaignId);

        // Remove campaign from recipient's list
        _removeFromArray(campaignsByRecipient[campaign.recipient], _campaignId);

        delete campaigns[_campaignId];
        emit CampaignDeleted(_campaignId);
    }

    /**
     * @dev Internal function to remove an element from an array
     * @param _array The array to remove from
     * @param _value The value to remove
     */
    function _removeFromArray(uint256[] storage _array, uint256 _value) internal {
        for (uint256 i = 0; i < _array.length; i++) {
            if (_array[i] == _value) {
                _array[i] = _array[_array.length - 1];
                _array.pop();
                break;
            }
        }
    }

    /**
     * @dev Set the official status of a campaign
     * @param _campaignId Campaign ID to update
     * @param _isOfficial New official status
     */
    function setOfficialStatus(uint256 _campaignId, bool _isOfficial) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.recipient, "Only recipient can update official status");
        campaign.isOfficial = _isOfficial;
        emit CampaignUpdated(_campaignId);
    }

    /**
     * @dev Check if a campaign is official
     * @param _campaignId Campaign ID to check
     * @return True if the campaign is official, false otherwise
     */
    function isOfficialCampaign(uint256 _campaignId) external view returns (bool) {
        return campaigns[_campaignId].isOfficial;
    }
}