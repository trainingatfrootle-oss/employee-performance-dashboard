import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Float "mo:core/Float";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Order "mo:core/Order";

import Runtime "mo:core/Runtime";



actor {
  public type Employee = {
    fiplCode : Text;
    name : Text;
    role : Text;
    department : Text;
    region : Text;
    status : { #active; #onHold };
    joinDate : Text;
    fseCategory : Text;
    avatarUrl : Text;
    familyDetails : Text;
    pastExperience : Text;
  };

  public type Performance = {
    fiplCode : Text;
    salesInfluenceIndex : Float;
    reviewCount : Nat;
    operationalDiscipline : Float;
    productKnowledgeScore : Float;
    softSkillsScore : Float;
    demoVisits : Nat;
    complaintVisits : Nat;
    videoCallDemos : Nat;
  };

  public type SWOT = {
    fiplCode : Text;
    strengths : [Text];
    weaknesses : [Text];
    opportunities : [Text];
    threats : [Text];
    cesScore : Float;
    traits : [Text];
    problems : [Text];
    feedbacks : [Text];
  };

  public type SalesRecord = {
    recordId : Nat;
    fiplCode : Text;
    brand : { #ecovacs; #kuvings; #coway; #tineco; #instant };
    product : Text;
    saleType : { #accessories; #extendedWarranty };
    quantity : Nat;
    amount : Float;
    saleDate : Text;
  };

  public type Attendance = {
    recordId : Nat;
    fiplCode : Text;
    labType : { #attendance; #eod; #daysBrief };
    daysOff : Nat;
    reason : Text;
    date : Text;
  };

  public type FeedbackEntry = {
    entryId : Nat;
    fiplCode : Text;
    customerName : Text;
    contact : Text;
    brand : { #ecovacs; #kuvings; #coway; #tineco; #instant };
    product : Text;
    cesScore : Float;
    remark : Text;
    callDate : Text;
    agent : Text;
  };

  public type DashboardStats = {
    totalEmployees : Nat;
    activeCount : Nat;
    totalSalesAmount : Float;
    averageCesScore : Float;
  };

  public type TopPerformer = {
    rank : Nat;
    fiplCode : Text;
    name : Text;
    accessories : Nat;
    extendedWarranty : Nat;
    totalSales : Float;
  };

  public type BatchResult = {
    successCount : Nat;
    failCount : Nat;
    errors : [Text];
  };

  let employees = Map.empty<Text, Employee>();
  let performances = Map.empty<Text, Performance>();
  let swots = Map.empty<Text, SWOT>();
  let salesRecords = Map.empty<Nat, SalesRecord>();
  let attendanceRecords = Map.empty<Nat, Attendance>();
  let feedbackEntries = Map.empty<Nat, FeedbackEntry>();
  let topPerformers = Map.empty<Nat, TopPerformer>();

  let salesByFIPL = Map.empty<Text, List.List<Nat>>();
  let attendanceByFIPL = Map.empty<Text, List.List<Nat>>();
  let feedbackByFIPL = Map.empty<Text, List.List<Nat>>();

  /// Key-value store for UI settings and persistent app data
  let kvStore = Map.empty<Text, Text>();

  var nextSalesId = 1;
  var nextAttendanceId = 1;
  var nextFeedbackId = 1;

  func getByFipl<T>(idList : ?List.List<Nat>, source : Map.Map<Nat, T>) : [T] {
    switch (idList) {
      case (null) { [] };
      case (?list) {
        list.map<Nat, T>(
          func(id) {
            switch (source.get(id)) {
              case (?record) { record };
              case (null) { Runtime.trap("Record not found") };
            };
          }
        ).toArray();
      };
    };
  };

  func comparePerformanceBySii(a : Performance, b : Performance) : Order.Order {
    Float.compare(b.salesInfluenceIndex, a.salesInfluenceIndex);
  };

  // ─── KEY-VALUE STORE ───────────────────────────────────────────────────────

  /// Set a key-value pair in the store.
  public shared func setKV(key : Text, value : Text) : async () {
    kvStore.add(key, value);
  };

  /// Get a value by key. Returns null if not found.
  public query func getKV(key : Text) : async ?Text {
    kvStore.get(key);
  };

  /// Get all key-value pairs as an array of (key, value) tuples.
  public query func getAllKV() : async [(Text, Text)] {
    kvStore.entries().toArray();
  };

  /// Delete a key from the store.
  public shared func deleteKV(key : Text) : async () {
    kvStore.remove(key);
  };

  /// Clear the entire key-value store.
  public shared func clearAllKV() : async () {
    kvStore.clear();
  };

  // ─── END KEY-VALUE STORE ───────────────────────────────────────────────────

  public query ({ caller }) func compareTopPerformersBySales(a : TopPerformer, b : TopPerformer) : async Order.Order {
    Float.compare(b.totalSales, a.totalSales);
  };

  public query ({ caller }) func getTopPerformers() : async [TopPerformer] {
    let performers = topPerformers.values().toArray();
    let sortedList = performers.sort(
      func(a, b) {
        Float.compare(b.totalSales, a.totalSales);
      }
    );
    sortedList;
  };

  public shared ({ caller }) func batchTopPerformersUpload(records : [TopPerformer]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      if (employees.containsKey(record.fiplCode)) {
        topPerformers.add(record.rank, record);
        successCount += 1;
      } else {
        errorsList.add("Employee does not exist for FIPL " # record.fiplCode);
        failCount += 1;
      };
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func batchEmployeeUpload(records : [Employee]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      employees.add(record.fiplCode, record);
      successCount += 1;
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func batchAttendanceUpload(records : [Attendance]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      if (not employees.containsKey(record.fiplCode)) {
        errorsList.add("FIPL does not exist for Attendance " # record.fiplCode);
        failCount += 1;
      } else {
        let newRecord = { record with recordId = nextAttendanceId };
        attendanceRecords.add(nextAttendanceId, newRecord);

        let existing = attendanceByFIPL.get(record.fiplCode);
        switch (existing) {
          case (null) {
            let newList = List.empty<Nat>();
            newList.add(nextAttendanceId);
            attendanceByFIPL.add(record.fiplCode, newList);
          };
          case (?list) {
            list.add(nextAttendanceId);
          };
        };

        nextAttendanceId += 1;
        successCount += 1;
      };
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func batchSalesUpload(records : [SalesRecord]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      if (not employees.containsKey(record.fiplCode)) {
        errorsList.add("FIPL does not exist for SalesRecord " # record.fiplCode);
        failCount += 1;
      } else {
        let newRecord = { record with recordId = nextSalesId };
        salesRecords.add(nextSalesId, newRecord);

        let existing = salesByFIPL.get(record.fiplCode);
        switch (existing) {
          case (null) {
            let newList = List.empty<Nat>();
            newList.add(nextSalesId);
            salesByFIPL.add(record.fiplCode, newList);
          };
          case (?list) {
            list.add(nextSalesId);
          };
        };

        nextSalesId += 1;
        successCount += 1;
      };
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func batchFeedbackUpload(records : [FeedbackEntry]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      if (not employees.containsKey(record.fiplCode)) {
        errorsList.add("FIPL does not exist for Feedback " # record.fiplCode);
        failCount += 1;
      } else {
        let newEntry = { record with entryId = nextFeedbackId };
        feedbackEntries.add(nextFeedbackId, newEntry);

        let existing = feedbackByFIPL.get(record.fiplCode);
        switch (existing) {
          case (null) {
            let newList = List.empty<Nat>();
            newList.add(nextFeedbackId);
            feedbackByFIPL.add(record.fiplCode, newList);
          };
          case (?list) {
            list.add(nextFeedbackId);
          };
        };

        nextFeedbackId += 1;
        successCount += 1;
      };
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func batchParametersUpload(records : [Performance]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      if (not employees.containsKey(record.fiplCode)) {
        errorsList.add("FIPL does not exist for Performance " # record.fiplCode);
        failCount += 1;
      } else {
        performances.add(record.fiplCode, record);
        successCount += 1;
      };
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func batchSWOTUpload(records : [SWOT]) : async BatchResult {
    var successCount = 0;
    var failCount = 0;
    let errorsList = List.empty<Text>();

    for (record in records.values()) {
      if (not employees.containsKey(record.fiplCode)) {
        errorsList.add("FIPL does not exist for SWOT " # record.fiplCode);
        failCount += 1;
      } else {
        swots.add(record.fiplCode, record);
        successCount += 1;
      };
    };

    {
      successCount;
      failCount;
      errors = errorsList.toArray();
    };
  };

  public shared ({ caller }) func addEmployee(employee : Employee) : async {
    #ok : ();
    #err : Text;
  } {
    if (employees.containsKey(employee.fiplCode)) {
      return #err("Employee with this FIPL code already exists");
    };
    employees.add(employee.fiplCode, employee);
    #ok;
  };

  public query ({ caller }) func getEmployee(fiplCode : Text) : async ?Employee {
    employees.get(fiplCode);
  };

  public shared ({ caller }) func updateEmployee(employee : Employee) : async () {
    employees.add(employee.fiplCode, employee);
  };

  public shared ({ caller }) func deleteEmployee(fiplCode : Text) : async () {
    employees.remove(fiplCode);
    performances.remove(fiplCode);
    swots.remove(fiplCode);

    switch (salesByFIPL.get(fiplCode)) {
      case (null) {};
      case (?recordIds) {
        for (id in recordIds.values()) {
          salesRecords.remove(id);
        };
        salesByFIPL.remove(fiplCode);
      };
    };

    switch (attendanceByFIPL.get(fiplCode)) {
      case (null) {};
      case (?recordIds) {
        for (id in recordIds.values()) {
          attendanceRecords.remove(id);
        };
        attendanceByFIPL.remove(fiplCode);
      };
    };

    switch (feedbackByFIPL.get(fiplCode)) {
      case (null) {};
      case (?entryIds) {
        for (id in entryIds.values()) {
          feedbackEntries.remove(id);
        };
        feedbackByFIPL.remove(fiplCode);
      };
    };
  };

  public query ({ caller }) func getAllEmployees() : async [Employee] {
    employees.values().toArray();
  };

  public query ({ caller }) func getActiveEmployees() : async [Employee] {
    employees.values().filter(
      func(e) {
        e.status == #active;
      }
    ).toArray();
  };

  public shared ({ caller }) func upsertPerformance(performance : Performance) : async {
    #ok : ();
    #err : Text;
  } {
    if (not employees.containsKey(performance.fiplCode)) {
      return #err("Employee not found");
    };
    performances.add(performance.fiplCode, performance);
    #ok;
  };

  public query ({ caller }) func getPerformanceByFIPL(fiplCode : Text) : async ?Performance {
    performances.get(fiplCode);
  };

  public query ({ caller }) func getAllPerformancesSortedBySII() : async [Performance] {
    performances.values().toArray().sort(comparePerformanceBySii);
  };

  public shared ({ caller }) func upsertSWOT(swot : SWOT) : async {
    #ok : ();
    #err : Text;
  } {
    if (not employees.containsKey(swot.fiplCode)) {
      return #err("Employee not found");
    };
    swots.add(swot.fiplCode, swot);
    #ok;
  };

  public query ({ caller }) func getSWOTByFIPL(fiplCode : Text) : async ?SWOT {
    swots.get(fiplCode);
  };

  public shared ({ caller }) func addSalesRecord(record : SalesRecord) : async {
    #ok : ();
    #err : Text;
  } {
    if (not employees.containsKey(record.fiplCode)) {
      return #err("Employee not found");
    };

    let newRecord = { record with recordId = nextSalesId };
    salesRecords.add(nextSalesId, newRecord);

    let existing = salesByFIPL.get(record.fiplCode);
    switch (existing) {
      case (null) {
        let newList = List.empty<Nat>();
        newList.add(nextSalesId);
        salesByFIPL.add(record.fiplCode, newList);
      };
      case (?list) {
        list.add(nextSalesId);
      };
    };

    nextSalesId += 1;
    #ok;
  };

  public query ({ caller }) func getSalesByFIPL(fiplCode : Text) : async [SalesRecord] {
    getByFipl(salesByFIPL.get(fiplCode), salesRecords);
  };

  public shared ({ caller }) func addAttendance(record : Attendance) : async {
    #ok : ();
    #err : Text;
  } {
    if (not employees.containsKey(record.fiplCode)) {
      return #err("Employee not found");
    };

    let newRecord = { record with recordId = nextAttendanceId };
    attendanceRecords.add(nextAttendanceId, newRecord);

    let existing = attendanceByFIPL.get(record.fiplCode);
    switch (existing) {
      case (null) {
        let newList = List.empty<Nat>();
        newList.add(nextAttendanceId);
        attendanceByFIPL.add(record.fiplCode, newList);
      };
      case (?list) {
        list.add(nextAttendanceId);
      };
    };

    nextAttendanceId += 1;
    #ok;
  };

  public query ({ caller }) func getAttendanceByFIPL(fiplCode : Text) : async [Attendance] {
    getByFipl(attendanceByFIPL.get(fiplCode), attendanceRecords);
  };

  public shared ({ caller }) func addFeedback(entry : FeedbackEntry) : async {
    #ok : ();
    #err : Text;
  } {
    if (not employees.containsKey(entry.fiplCode)) {
      return #err("Employee not found");
    };

    let newEntry = { entry with entryId = nextFeedbackId };
    feedbackEntries.add(nextFeedbackId, newEntry);

    let existing = feedbackByFIPL.get(entry.fiplCode);
    switch (existing) {
      case (null) {
        let newList = List.empty<Nat>();
        newList.add(nextFeedbackId);
        feedbackByFIPL.add(entry.fiplCode, newList);
      };
      case (?list) {
        list.add(nextFeedbackId);
      };
    };

    nextFeedbackId += 1;
    #ok;
  };

  public query ({ caller }) func getFeedbackByFIPL(fiplCode : Text) : async [FeedbackEntry] {
    getByFipl(feedbackByFIPL.get(fiplCode), feedbackEntries);
  };

  public query ({ caller }) func getDashboardStats() : async DashboardStats {
    var totalEmployees = 0;
    var activeCount = 0;
    var totalSalesAmount : Float = 0.0;
    var totalCesScore : Float = 0.0;
    var totalFeedback = 0;

    totalEmployees := employees.size();

    for ((_, employee) in employees.entries()) {
      if (employee.status == #active) {
        activeCount += 1;
      };
    };

    for ((_, sale) in salesRecords.entries()) {
      totalSalesAmount += sale.amount;
    };

    for ((_, feedback) in feedbackEntries.entries()) {
      totalCesScore += feedback.cesScore;
      totalFeedback += 1;
    };

    let averageCesScore = if (totalFeedback > 0) {
      totalCesScore / totalFeedback.toFloat();
    } else {
      0.0;
    };

    {
      totalEmployees;
      activeCount;
      totalSalesAmount;
      averageCesScore;
    };
  };

  /// DELETE OPERATIONS

  /// Delete all employees and all related data.
  public func deleteAllEmployees() {
    employees.clear();
    performances.clear();
    swots.clear();
    salesRecords.clear();
    attendanceRecords.clear();
    feedbackEntries.clear();
    salesByFIPL.clear();
    attendanceByFIPL.clear();
    feedbackByFIPL.clear();
    topPerformers.clear();
    nextSalesId := 1;
    nextAttendanceId := 1;
    nextFeedbackId := 1;
  };

  /// Delete only sales records
  public func deleteAllSales() {
    salesRecords.clear();
    salesByFIPL.clear();
    nextSalesId := 1;
  };

  /// Delete only attendance records
  public func deleteAllAttendance() {
    attendanceRecords.clear();
    attendanceByFIPL.clear();
    nextAttendanceId := 1;
  };

  /// Delete only SWOT records
  public func deleteAllSWOT() {
    swots.clear();
  };

  /// Delete only performance/parameters records
  public func deleteAllPerformances() {
    performances.clear();
  };

  /// Delete only feedback/calling records
  public func deleteAllFeedback() {
    feedbackEntries.clear();
    feedbackByFIPL.clear();
    nextFeedbackId := 1;
  };

  /// Delete only top performer records
  public func deleteAllTopPerformers() {
    topPerformers.clear();
  };

  /// Delete all data (employees, sales, attendance, SWOT, performance, feedback, top performers)
  public shared ({ caller }) func deleteAllData() : async () {
    deleteAllEmployees();
    deleteAllSales();
    deleteAllAttendance();
    deleteAllSWOT();
    deleteAllPerformances();
    deleteAllFeedback();
    deleteAllTopPerformers();
  };
};
