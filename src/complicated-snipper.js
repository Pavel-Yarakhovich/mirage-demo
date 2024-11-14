import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    Renderer2,
    ViewChild,
    inject,
    signal,
  } from '@angular/core';
  import { FormGroup } from '@angular/forms';
  import { catchError, EMPTY, filter, fromEvent, switchMap, tap } from 'rxjs';
  import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
  import {
    CellClickedEvent,
    ColDef,
    IRowNode,
    RowGroupOpenedEvent,
    RowSelectionOptions,
  } from 'ag-grid-community';
  import { v4 as uuidv4 } from 'uuid';
  import { MatTooltip } from '@angular/material/tooltip';
  import { ButtonDirective } from 'kpd-library';
  import { NgClass } from '@angular/common';
  import { TranslocoModule } from '@ngneat/transloco';
  
  import { timeRegistrationRowConst } from '../../entity/constants/time-registration-row.const';
  import { TimeRegistrationSourceEnum } from 'core/entity/enums/data-entry/time-registration-source.enum';
  import { DeGridStateManagementService } from '../../services/de-grid-state-management.service';
  import { PayCodeTypeEnum } from 'core/entity/enums/data-entry/paycode-type.enum';
  import { TypeOfHoursEnum } from 'core/entity/enums/masterdata/paycodes/type-of-hours.enum';
  import { DeGridConfigService } from '../../services/de-grid-config.service';
  import { DeUtilityService } from '../../services/de-utility.service';
  import { DataEntryDataLoadingComponent } from './data-entry-data-loading.component';
  import { TimeRegistrationWithControlsInterface } from '../../entity/interfaces/data-entry-list-with-controls.interface';
  import { DeGridWorkflowService } from 'features/data-entry/services/de-grid-workflow.service';
  import { getDataEntrySystemViews } from 'features/data-entry/entity/functions/get-system-views';
  import { UnitsEnum } from 'core/entity/enums/data-entry/units.enum';
  import { generateRowControlsFunction } from '../../entity/functions/generate-row-controls.function';
  
  import { DataViewComponent } from 'shared/components';
  import { TranslationsStore, CompanyStore } from 'shared/state';
  import {
    DataEntryService,
    AdditionalDataService,
    ReferenceDataService,
    NotificationsService,
    MobilityService,
    EmployeesService,
    SettingService,
  } from 'core/services';
  import {
    MobilityMapDistanceDetermination,
    MobilityTypeInterface,
    CalendarInterface,
    NoRowsOverlayComponentParamsInterface,
    PeriodInterface,
    ActivityInterface,
    WeeklySchedulePeriod,
    WeeklySchedulesInterface,
    PaycodeInterface,
    EmployeesInterface,
  } from 'core/entity/interfaces';
  import { DataEntrySourceEnum } from 'app/core/entity/enums/data-entry/data-entry-source.enum';
  import { TimeRegistrationInterface } from '../../entity/interfaces/data-entry-list.interface';
  
  @UntilDestroy()
  @Component({
    selector: 'kpd-data-entry-table',
    templateUrl: './data-entry-table.component.html',
    styleUrls: ['./data-entry-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
      TranslocoModule,
      DataViewComponent,
      NgClass,
      ButtonDirective,
      MatTooltip,
    ],
  })
  export class DataEntryTableComponent
    extends DataEntryDataLoadingComponent
    implements AfterViewInit, OnInit, OnDestroy
  {
    @ViewChild('agGrid') agGrid: DataViewComponent;
  
    @Input() givenFilters: any;
    @Input() isPopup: boolean = false;
    @Input() cachedSharedData: any;
    @Input() providedSelectedPeriod: PeriodInterface;
    @Input() periodIsClosed: boolean;
    @Input() withSavedViews: boolean = true;
  
    @Output()
    handleCellValueChanged = new EventEmitter<any>();
  
    @Output()
    onSharedDataLoaded = new EventEmitter<any>();
  
    @Output()
    onChangesSaved = new EventEmitter<void>();
  
    @Output()
    onChangesDiscarded = new EventEmitter<void>();
  
    @Output()
    onFirstGridDataRendered = new EventEmitter<void>();
  
    private globalClickListener: () => void;
  
    isGridDataBeingEditing = signal(false);
  
    activeCompanyId = inject(CompanyStore).activeCompanyId;
    translationsStore = inject(TranslationsStore);
    translations: { [key: string]: string } =
      this.translationsStore.translations();
  
    showBottomBar: boolean = false;
    editedRowsNumber: number = 0;
    systemViews = getDataEntrySystemViews();
    noRowsOverlayComponentParams: NoRowsOverlayComponentParamsInterface;
    rowSelection: RowSelectionOptions = {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: false,
      hideDisabledCheckboxes: true,
      isRowSelectable: (node: IRowNode) => {
        return !node.group;
      },
    };
  
    form: FormGroup;
  
    constructor(
      dataEntryService: DataEntryService,
      referenceDataService: ReferenceDataService,
      gridStateManagementService: DeGridStateManagementService,
      employeesService: EmployeesService,
      cdr: ChangeDetectorRef,
      elRef: ElementRef,
      renderer: Renderer2,
      gridConfigService: DeGridConfigService,
      utilityService: DeUtilityService,
      mobilityService: MobilityService,
      settingService: SettingService,
      additionalDataService: AdditionalDataService,
      private notificationsService: NotificationsService,
      private gridWorkflowService: DeGridWorkflowService
    ) {
      super(
        dataEntryService,
        referenceDataService,
        gridStateManagementService,
        employeesService,
        settingService,
        additionalDataService,
        cdr,
        elRef,
        renderer,
        gridConfigService,
        utilityService,
        mobilityService
      );
    }
  
    ngOnInit(): void {
      super.ngOnInit();
      this.readOnly = this.periodIsClosed;
      this.initializeSubscriptions();
      this.initializeShortcuts();
      this.initializeSharedDataSubscription();
      this.initializeEditedRowsSubscription();
      this.initializeNoRowsOverlayParams();
    }
  
    private initializeSubscriptions(): void {
      this.subscribeToCopyRow();
      this.subscribeToCopyRowWithIncrement();
      this.subscribeToAddNewRow();
    }
  
    private initializeShortcuts(): void {
      this.listenAddRowShortcut();
      this.listenDuplicateRowShortcut();
      this.listenCopyWithIncrementShortcut();
      this.listenSaveAllShortcut();
      this.listenDiscardAllShortcut();
      this.listenDeleteRowShortcut();
    }
  
    private initializeSharedDataSubscription(): void {
      if (this.sharedData$) {
        this.sharedData$.subscribe((data: any) =>
          this.onSharedDataLoaded.emit(data)
        );
      }
    }
  
    private initializeEditedRowsSubscription(): void {
      this.gridStateManagementService.editedRows$
        .pipe(untilDestroyed(this))
        .subscribe((data: IRowNode<any>[]) => {
          this.showBottomBar = data.length > 0;
          this.editedRowsNumber = data.length;
        });
    }
  
    private initializeNoRowsOverlayParams(): void {
      this.noRowsOverlayComponentParams = {
        text: this.translations['dataEntry.dataEntryTable.noDataForPeriod'],
        buttonText: this.translations['dataEntry.dataEntryTable.newRow'],
        buttonClickHandler: async () => this.onAddNewRow(),
      };
    }
  
    ngAfterViewInit() {
      this.globalClickListener = this.renderer.listen(
        'document',
        'click',
        (event: MouseEvent) => {
          if (this.agGrid?.gridApi()) {
            const focusedCell = this.agGrid.gridApi().getFocusedCell();
            if (
              focusedCell &&
              focusedCell.column.getColId() !== 'date' &&
              !this.elRef.nativeElement.contains(event.target)
            ) {
              this.blurFocusedCell();
            }
          }
        }
      );
    }
  
    private subscribeToAddNewRow(): void {
      this.gridStateManagementService.addNewRowEmitter
        .pipe(untilDestroyed(this))
        .subscribe(() => {
          this.onAddNewRow();
        });
    }
  
    blurFocusedCell(): void {
      if (this.agGrid?.gridApi()) {
        this.agGrid.gridApi().stopEditing();
        this.agGrid.gridApi().clearFocusedCell();
      }
    }
  
    onFirstDataRendered(): void {
      this.onFirstGridDataRendered.emit();
    }
  
    rowGroupOpened(
      event: RowGroupOpenedEvent<TimeRegistrationWithControlsInterface>
    ): void {
      if (event.expanded && event.node.leafGroup) {
        this.activeLeafGroup = event.node;
      }
    }
  
    onCellClicked(
      event: CellClickedEvent<TimeRegistrationWithControlsInterface>
    ): void {
      if (event.node.group && event.node.leafGroup) {
        this.activeLeafGroup = event.node;
      } else if (event.node.parent?.group && event.node.parent?.leafGroup) {
        this.activeLeafGroup = event.node.parent;
      } else {
        this.activeLeafGroup = null;
      }
    }
  
    onCellValueChanged(event: any): void {
      const isValidChange = this.gridWorkflowService.validateCellValueChange(
        event.colDef.field,
        event.oldValue,
        event.newValue
      );
  
      if (!isValidChange) return;
  
      const rowData = this.rowData?.find((row) => row?.uuid === event.data?.uuid);
      if (!rowData) return;
  
      this.handleCellValueChanged.emit(event);
      this.markRowAsEdited(event.node, rowData);
  
      switch (event.colDef.field) {
        case 'date': {
          this.handleDateChange(rowData, event);
          break;
        }
        case 'employeeOrEquipment':
          this.handleEmployeeOrEquipmentChange(rowData, event);
          break;
        case 'destinationId': {
          this.validateActivity(rowData, event);
          this.gridWorkflowService.clearMobilityAndDisplacementKilometers(
            rowData
          );
          break;
        }
        case 'payCodeId': {
          this.handlePayCodeChange(rowData, event);
          break;
        }
        case 'startTime':
        case 'endTime':
        case 'pause': {
          this.countQuantityForTimeFields(rowData, event.rowIndex);
          break;
        }
        case 'mobilityTypeId': {
          this.gridWorkflowService.clearMobilityAndDisplacementKilometers(
            rowData
          );
          break;
        }
      }
  
      this.updateRowData(
        event.colDef.field,
        event.newValue,
        rowData,
        event.rowIndex
      );
      this.gridApi.redrawRows({ rowNodes: [event.node] });
    }
  
    onCellEditingStarted(): void {
      this.isGridDataBeingEditing.set(true);
    }
    onCellEditingStopped(): void {
      this.isGridDataBeingEditing.set(false);
    }
  
    private markRowAsEdited(node: any, rowData: any): void {
      rowData.hasChanged = true;
      this.gridStateManagementService.addEditedRow(node);
      this.gridStateManagementService.emitEnableAddNewRowEvent(false);
    }
  
    private handleDateChange(rowData: any, event: any): void {
      const isValidDate = this.utilityService.checkDateInRange(
        rowData.date,
        this.selectedPeriod?.startDate,
        this.selectedPeriod?.endDate
      );
  
      const isHoliday = this.utilityService.isDateHoliday(
        rowData.date,
        this.auxData().calendars
      );
  
      if (isValidDate && isHoliday) {
        const holiday = this.utilityService.getDateFromCalendar(
          rowData.date,
          this.auxData().calendars
        ) as CalendarInterface;
  
        if (holiday) {
          this.updateRowData(
            'payCodeId',
            holiday.payCodeId,
            rowData,
            event.rowIndex
          );
        }
      } else {
        this.gridWorkflowService.updateDateFieldValidations(
          rowData,
          event.newValue,
          this.selectedPeriod,
          this.auxData().calendars
        );
        if (this.utilityService.isSelectedDateWeekend(rowData.date)) {
          this.gridWorkflowService.clearMobilityFields(rowData);
        }
      }
    }
  
    private handlePayCodeChange(rowData: any, event: any): void {
      this.formatUnit(event.newValue, rowData, event.rowIndex);
      if (
        rowData.payCodeId &&
        !this.gridWorkflowService.isMobilityAllowedForPayCode(
          this.auxData().payCodes,
          rowData.payCodeId
        )
      ) {
        this.gridWorkflowService.clearMobilityFields(rowData);
      }
    }
  
    private handleEmployeeOrEquipmentChange(
      rowData: TimeRegistrationWithControlsInterface,
      event: any
    ): void {
      if (!rowData.employeeOrEquipment) {
        this.clearEquipmentFieldsAndRedraw(rowData, event.node);
      } else if (rowData.employeeOrEquipment.optionType === 'Equip.') {
        this.handleEquipmentChange(rowData, event);
      } else {
        this.handleEmployeeChange(rowData, event);
      }
    }
  
    private clearEquipmentFieldsAndRedraw(
      rowData: TimeRegistrationWithControlsInterface,
      node: any
    ): void {
      this.clearEquipmentFields(rowData);
      this.gridWorkflowService.clearMobilityFields(rowData);
      this.gridApi.redrawRows({ rowNodes: [node] });
    }
  
    private handleEquipmentChange(
      rowData: TimeRegistrationWithControlsInterface,
      event: any
    ): void {
      this.clearEquipmentFields(rowData);
      this.prefillEquipmentFields(event.newValue.id, rowData, event.rowIndex);
      this.prefillPayCodeFromDefaultEquipment(rowData, event);
      if (rowData.employeeOrEquipment.id) {
        this.gridWorkflowService.clearMobilityFields(rowData);
      }
    }
  
    private handleEmployeeChange(
      rowData: TimeRegistrationWithControlsInterface,
      event: any
    ): void {
      this.gridWorkflowService.clearMobilityAndDisplacementKilometers(rowData);
      this.getEmployeeAndPrefillPayCodeAndBoardingPoint(
        event.newValue.id,
        rowData,
        event.rowIndex,
        event.node
      );
      this.gridApi.redrawRows({ rowNodes: [event.node] });
    }
  
    private prefillPayCodeFromDefaultEquipment(
      rowData: TimeRegistrationWithControlsInterface,
      event: any
    ): void {
      const equipmentPayCode = this.auxData().payCodes?.find(
        (pay: PaycodeInterface) =>
          pay.payCodeType === PayCodeTypeEnum.EquipmentMaterial
      );
      if (equipmentPayCode) {
        this.updateRowData(
          'payCodeId',
          equipmentPayCode.id,
          rowData,
          event.rowIndex
        );
        this.updateRowData('quantity', null, rowData, event.rowIndex);
        this.formatUnit(equipmentPayCode.id, rowData, event.rowIndex);
        this.gridWorkflowService.clearMobilityFields(rowData);
      }
    }
  
    private clearEquipmentFields(rowData: any): void {
      const fields = [
        'machineEquipmentId',
        'equipmentActivity',
        'equipmentQuantity',
      ];
      fields.forEach((field) => {
        rowData[field] = null;
        rowData[field + 'Control'] = null;
      });
    }
  
    formatUnit(
      payCodeId: number | undefined,
      rowData: any,
      rowIndex: number
    ): void {
      const formattedUnit: UnitsEnum | string =
        this.gridWorkflowService.getFormattedUnit(
          this.auxData().payCodes,
          payCodeId
        );
      if (formattedUnit === UnitsEnum.Amount) {
        ['startTime', 'endTime', 'pause'].forEach((field) => {
          this.updateRowData(field, '', rowData, rowIndex);
        });
        this.updateRowData('quantity', 0, rowData, rowIndex);
      }
      this.updateRowData('unit', formattedUnit, rowData, rowIndex);
      this.gridApi.redrawRows({ rowNodes: rowData.node });
    }
  
    updateRowData(
      field: string,
      newValue: any,
      rowData: TimeRegistrationWithControlsInterface,
      rowIndex: number,
      shouldFocusCellOnUpdate: boolean = true
    ): void {
      rowData[field] = newValue;
      rowData[`${field}Control`]?.setValue(newValue);
  
      if (field && this.gridApi && shouldFocusCellOnUpdate) {
        setTimeout(() => {
          this.gridApi.setFocusedCell(rowIndex, field);
        }, 200);
      }
    }
  
    private async validateActivity(rowData: any, event: any): Promise<void> {
      const projectActivities =
        event.context.activitiesPerProjectSubject$?.getValue()?.[event.newValue];
  
      if (projectActivities) {
        this.processActivityValidation(projectActivities, rowData, event);
      } else {
        const activities = await this.fetchAndValidateActivities(event);
        this.processActivityValidation(
          activities as ActivityInterface[],
          rowData,
          event
        );
      }
    }
  
    private processActivityValidation(
      data: ActivityInterface[],
      rowData: any,
      event: any
    ): void {
      this.clearActivityIfInvalid(data, rowData);
  
      const foundItem = data.find(
        (activity) => activity.code === rowData.activity?.code
      );
      if (foundItem) {
        rowData.activity = foundItem;
        rowData.activityControl.setValue(foundItem);
        if (!this.isValidDateForActivity(rowData.date, foundItem)) {
          this.clearAssignedActivity(rowData);
        }
      } else {
        this.clearAssignedActivity(rowData);
      }
  
      this.updateAndRedrawRow(rowData, event);
    }
  
    private async fetchAndValidateActivities(event: any): Promise<any> {
      return new Promise((resolve) => {
        this.dataEntryService
          .getActivitiesForDestination(event.newValue)
          .pipe(untilDestroyed(this))
          .subscribe((data: ActivityInterface[]) => {
            event.context.addMissingActivities(
              { [event.newValue]: data },
              event.context
            );
            resolve(data);
          });
      });
    }
  
    private clearActivityIfInvalid(
      data: ActivityInterface[],
      rowData: any
    ): void {
      if (!data) {
        this.clearAssignedActivity(rowData);
      }
    }
  
    private clearAssignedActivity(rowData: any): void {
      rowData.activity = null;
      rowData.activityControl.setValue(null);
    }
  
    private isValidDateForActivity(
      date: string,
      activity: ActivityInterface
    ): boolean {
      return this.utilityService.checkDateInRange(
        date,
        activity.beginDate ?? '',
        activity.endDate ?? ''
      );
    }
  
    private updateAndRedrawRow(rowData: any, event: any): void {
      this.updateRowData(
        'activity',
        rowData.activity,
        rowData,
        event.rowIndex,
        false
      );
      this.gridApi.redrawRows({ rowNodes: [event.node] });
    }
  
    countQuantityForTimeFields(rowData: any, rowIndex: number): void {
      const workedHours =
        this.gridWorkflowService.getQuantityCountForTimeFields(rowData);
  
      if (workedHours) {
        this.updateRowData(
          'quantity',
          Number(workedHours?.toFixed(2)),
          rowData,
          rowIndex
        );
      }
    }
  
    getEmployeeAndPrefillPayCodeAndBoardingPoint(
      employeeId: number | string,
      rowData: TimeRegistrationWithControlsInterface,
      rowIndex: number,
      node: any
    ) {
      if (!employeeId) return;
  
      this.employeesService
        .getEmployeesById(Number(employeeId), this.activeCompanyId()!)
        .pipe(
          untilDestroyed(this),
          switchMap((employee) => {
            if (!employee) return EMPTY;
  
            const isHoliday = this.utilityService.isDateHoliday(
              rowData.date,
              this.auxData().calendars
            );
            const isWeekend = this.utilityService.isSelectedDateWeekend(
              rowData.date
            );
            if (!isHoliday && !isWeekend) {
              this.prefillBoardingPoint(employee, rowData, rowIndex);
            } else {
              this.updateRowData('boardingPointId', null, rowData, rowIndex);
            }
  
            return this.processEmployeeWeeklySchedule(
              employee,
              rowData,
              rowIndex
            );
          }),
          tap(() => this.gridApi.redrawRows({ rowNodes: [node] }))
        )
        .subscribe();
    }
  
    prefillBoardingPoint(
      employee: EmployeesInterface,
      rowData: TimeRegistrationWithControlsInterface,
      rowIndex: number
    ) {
      if (!employee.boardingPointId) {
        this.updateRowData('boardingPointId', null, rowData, rowIndex);
        return;
      }
  
      const isWeekend = this.utilityService.isSelectedDateWeekend(rowData.date);
      if (isWeekend) {
        this.updateRowData('boardingPointId', null, rowData, rowIndex);
        return;
      }
  
      if (employee.mobilityTypeId) {
        const relatedMobilityType = this.auxData().mobilityTypes.find(
          (type: MobilityTypeInterface) => type.id === employee.mobilityTypeId
        );
        const mobilityTypeRequiresBoardingPoint =
          relatedMobilityType &&
          [
            MobilityMapDistanceDetermination.departmentToBoardingPlace,
            MobilityMapDistanceDetermination.employeeToBoardingPlace,
            MobilityMapDistanceDetermination.employeeToBoardingPlaceToOfficeToYard,
            MobilityMapDistanceDetermination.employeeToBoardingPlaceToYard,
            MobilityMapDistanceDetermination.officeToBoardingPlace,
            MobilityMapDistanceDetermination.boardingPlaceToYard,
          ].includes(relatedMobilityType.mobilityMapDistanceDetermination);
  
        if (mobilityTypeRequiresBoardingPoint) {
          this.updateRowData(
            'boardingPointId',
            employee.boardingPointId,
            rowData,
            rowIndex
          );
        }
      }
    }
  
    processEmployeeWeeklySchedule(
      employee: EmployeesInterface,
      rowData: TimeRegistrationWithControlsInterface,
      rowIndex: number
    ) {
      const { regimeId, payCodeId } = employee;
      const employeeWeeklySchedules =
        this.auxData().weeklySchedules?.filter(
          (item: WeeklySchedulesInterface) => item.regimeId === regimeId
        ) || [];
  
      let determinedWS =
        employeeWeeklySchedules.length > 1
          ? employeeWeeklySchedules.filter(
              (item: WeeklySchedulesInterface) => item.payCodeId == payCodeId
            )
          : employeeWeeklySchedules;
  
      if (determinedWS.length !== 1) {
        return this.handleMultipleOrNoWeeklySchedules(
          employee,
          rowData,
          rowIndex
        );
      }
  
      return this.dataEntryService
        .getWeeklyScheduleById(determinedWS[0].id, this.activeCompanyId()!)
        .pipe(
          untilDestroyed(this),
          tap((ws) =>
            this.handleSingleWeeklySchedule(ws, employee, rowData, rowIndex)
          )
        );
    }
  
    handleMultipleOrNoWeeklySchedules(
      employee: EmployeesInterface,
      rowData: TimeRegistrationWithControlsInterface,
      rowIndex: number
    ) {
      const employeePayCode = this.auxData().payCodes?.find(
        (pay: PaycodeInterface) => pay.id === Number(employee.payCodeId)
      );
      if (employeePayCode) {
        this.updateRowData('payCodeId', employeePayCode.id, rowData, rowIndex);
        this.prefillMobilityType(employeePayCode.id, employee, rowData, rowIndex);
        this.formatUnit(employeePayCode.id, rowData, rowIndex);
      }
      return EMPTY;
    }
  
    private handleSingleWeeklySchedule(
      ws: WeeklySchedulesInterface,
      employee: EmployeesInterface,
      rowData: any,
      rowIndex: number
    ) {
      if (!ws) return;
  
      const wsPeriod: WeeklySchedulePeriod =
        this.gridWorkflowService.determineWSPeriodViaDate(rowData.date, ws);
  
      if (wsPeriod) {
        const payCodeId = wsPeriod.defaultPayCodeId || wsPeriod.payCodeId;
  
        if (wsPeriod.defaultHours && !isNaN(Number(wsPeriod.defaultHours))) {
          this.prefillQuantity(payCodeId, employee, wsPeriod, rowData, rowIndex);
        }
  
        if (payCodeId) {
          this.updateRowData('payCodeId', payCodeId, rowData, rowIndex);
          this.formatUnit(payCodeId, rowData, rowIndex);
          this.prefillMobilityType(payCodeId, employee, rowData, rowIndex);
        } else {
          this.handleMultipleOrNoWeeklySchedules(employee, rowData, rowIndex);
        }
      }
    }
  
    private prefillMobilityType(
      payCodeId: number,
      employee: EmployeesInterface,
      rowData: any,
      rowIndex: number
    ) {
      const relatedPaycode = this.auxData()?.payCodes?.find(
        (paycode: PaycodeInterface) => paycode.id === payCodeId
      );
  
      const paycodeHasMobility = relatedPaycode && relatedPaycode.hasMobility;
      const employeeHasMobility = employee && employee.mobilityTypeId;
      const isWeekend = this.utilityService.isSelectedDateWeekend(rowData.date);
      if (paycodeHasMobility && employeeHasMobility && !isWeekend) {
        this.updateRowData(
          'mobilityTypeId',
          employee.mobilityTypeId,
          rowData,
          rowIndex
        );
      } else {
        this.updateRowData('mobilityTypeId', null, rowData, rowIndex);
        this.updateRowData('boardingPointId', null, rowData, rowIndex);
      }
    }
  
    private calculateDefaultHoursForEmployeeDate(
      employee: EmployeesInterface,
      wsPeriod: WeeklySchedulePeriod,
      currentRow: TimeRegistrationWithControlsInterface
    ) {
      const defaultHours =
        wsPeriod && wsPeriod?.defaultHours ? wsPeriod?.defaultHours : 0;
  
      const foundEntries =
        this.gridWorkflowService.findIfEntryWithTheSameEmployeeAndDateExists(
          this.rowData,
          currentRow,
          employee,
          this.auxData()?.payCodes
        );
  
      const alreadyLoggedHours = foundEntries.reduce(
        (acc, curr) => (curr?.quantity ? acc + curr?.quantity : acc),
        0
      );
  
      return defaultHours
        ? Number(defaultHours) - Number(alreadyLoggedHours)
        : null;
    }
  
    private prefillQuantity(
      payCodeId: number | undefined,
      employee: EmployeesInterface,
      wsPeriod: WeeklySchedulePeriod,
      currentRow: TimeRegistrationWithControlsInterface,
      rowIndex: number
    ) {
      const paycodeHasValidType = (payCodeId: number): boolean => {
        const payCode = this.auxData().payCodes?.find(
          (pay: PaycodeInterface) => pay.id === Number(payCodeId)
        );
        return !!payCode && payCode.typeOfHours !== TypeOfHoursEnum.NotHours;
      };
  
      const canPrefillQuantity = !payCodeId || paycodeHasValidType(payCodeId);
  
      if (canPrefillQuantity) {
        const defaultHoursForEmployeeDate =
          this.calculateDefaultHoursForEmployeeDate(
            employee,
            wsPeriod,
            currentRow
          );
  
        this.updateRowData(
          'quantity',
          defaultHoursForEmployeeDate,
          currentRow,
          rowIndex
        );
      }
    }
  
    prefillEquipmentFields(
      equipmentId: number,
      rowData: TimeRegistrationWithControlsInterface,
      rowIndex: number
    ) {
      if (!equipmentId) return;
  
      const equipmentPayCode = this.auxData().payCodes?.find(
        (pay: PaycodeInterface) =>
          pay?.payCodeType === PayCodeTypeEnum.EquipmentMaterial
      )?.code;
  
      if (equipmentPayCode) {
        this.updateRowData('quantity', '', rowData, rowIndex);
        this.updateRowData(
          'payCodeId',
          equipmentPayCode || '',
          rowData,
          rowIndex
        );
      }
    }
  
    /**
     * The function checks if a new row can be added based on certain filter
     * conditions and returns a summary message along with prefilled row data.
     * It returns:
     * 1. A boolean value indicating whether procedure is allowed.
     * 2. An object containing data from the first rendered row for each active filter key.
     * 3. A message string detailing the reasons why a new row cannot be added.
     * 4. rowGroupColumns - active groups array
     */
    checkIfGridStateAllowsProcedure(
      procedureName: string,
      copyWithIncrement: boolean = false
    ): {
      isProcedureAllowed: boolean;
      prefilledRowData: Partial<TimeRegistrationInterface>;
      errorMessage: string;
      rowGroupColumns: string[];
    } {
      const prefilledRowData: Partial<TimeRegistrationInterface> = {};
      let errorMessages: string[] = [];
  
      const filters = this.gridApi.getFilterModel();
      const renderedRows = this.gridApi.getRenderedNodes();
      const columnDefs = this.gridApi.getColumnDefs();
  
      const allowedFilterKeys = [
        'destinationId',
        'activity',
        'employeeOrEquipment',
      ];
      if (!copyWithIncrement) {
        allowedFilterKeys.push('date');
      }
  
      const activeFilterKeys = Object.keys(
        filters
      ) as (keyof TimeRegistrationInterface)[];
  
      if (activeFilterKeys.length > 0) {
        activeFilterKeys.forEach((key) => {
          if (key === 'source') {
            const isValidSource = filters[key].values.includes(
              String(TimeRegistrationSourceEnum.Manual)
            );
            if (!isValidSource) {
              errorMessages.push(
                this.translations[
                  'dataEntry.dataEntryTable.manualEntrySourceIsFilteredOut'
                ]
              );
            }
          } else {
            const isAllowedKey = allowedFilterKeys.includes(key);
            if (!isAllowedKey) {
              const relatedColumn = columnDefs?.find(
                (col: ColDef) => col.colId === key
              );
              if (relatedColumn) {
                errorMessages.push(
                  `${relatedColumn.headerName} ${this.translations['dataEntry.dataEntryTable.columnFiltered']}`
                );
              }
            }
          }
        });
  
        activeFilterKeys.forEach((key) => {
          prefilledRowData[key] = renderedRows[0].data[key];
        });
      }
  
      // Check if rows are grouped
      const rowGroupColumns = this.gridApi.getRowGroupColumns().map((col) => {
        const colId = col.getColId();
        return colId;
      }) as (keyof TimeRegistrationInterface)[];
  
      if (rowGroupColumns?.length > 0) {
        // Leaf group can exist only if it contains at least one item
        // If active leaf group is specified, we get its first item and
        // copy values which participate in current grouping setup
        const targetNode = this.activeLeafGroup?.allLeafChildren?.[0];
  
        if (targetNode && rowGroupColumns.length > 0) {
          // Check if item can be added to the group
          const allowedGroups = [
            'source',
            'date',
            'destinationId',
            'activity',
            'employeeOrEquipment',
          ];
  
          if (
            rowGroupColumns.some(
              (colId: string) => !allowedGroups.includes(colId)
            )
          ) {
            errorMessages.push(
              this.translations[
                'dataEntry.dataEntryTable.procedureBlockedByUnsupportedGroupsRange'
              ]
            );
          }
  
          if (
            rowGroupColumns.includes('source') &&
            targetNode['data']?.['source'] !== DataEntrySourceEnum.MANUAL_ENTRY
          ) {
            errorMessages.push(
              this.translations[
                'dataEntry.dataEntryTable.procedureBlockedBySourceGroup'
              ]
            );
          }
  
          this.gridApi.setRowNodeExpanded(targetNode, true, true);
          rowGroupColumns.forEach(
            (colId) => (prefilledRowData[colId] = targetNode['data']?.[colId])
          );
          // Groups exist, but active leaf group is not specified
        } else if (rowGroupColumns.length > 0) {
          errorMessages.push(
            this.translations['dataEntry.dataEntryTable.specifyTargetGroup']
          );
        }
      }
  
      const message = `Cannot ${procedureName} due to: ${errorMessages.join(', ')}`;
  
      return {
        isProcedureAllowed: errorMessages.length === 0,
        prefilledRowData,
        errorMessage: message,
        rowGroupColumns,
      };
    }
  
    onAddNewRow(): void {
      const {
        isProcedureAllowed,
        prefilledRowData,
        errorMessage,
        rowGroupColumns,
      } = this.checkIfGridStateAllowsProcedure(
        this.translations['dataEntry.add.addNewRow']
      );
  
      if (!isProcedureAllowed) {
        this.notificationsService.openSnackbar(errorMessage);
        return;
      }
  
      this.gridApi.deselectAll();
  
      const rowUuid = uuidv4();
      const newRow: TimeRegistrationWithControlsInterface = {
        ...timeRegistrationRowConst,
        uuid: rowUuid,
      };
  
      if (Object.keys(prefilledRowData).length > 0) {
        Object.entries(prefilledRowData).forEach(([key, value]): any => {
          newRow[key] = value;
          newRow[`${key}Control`]?.setValue(value);
        });
      }
  
      if (this.givenFilters) {
        const date = this.datePipe.transform(
          this.givenFilters.anomalyDate,
          'dd/MM/yyyy'
        );
        newRow.date = date;
        newRow.dateControl!.setValue(date);
        newRow.employeeOrEquipment = {
          id: this.givenFilters.employeeId,
          optionType: 'Empl.',
        };
        prefilledRowData.employeeId = this.givenFilters.employeeId;
      }
  
      this.rowData = [{ ...newRow }, ...this.rowData];
  
      this.updateRowDataWithControls(this.rowData);
      this.gridApi.setGridOption('rowData', this.rowData);
  
      if (this.gridApi) {
        setTimeout(() => {
          const renderedNodes = this.gridApi.getRenderedNodes();
          const newlyAddedNode = renderedNodes.find(
            (node) => node.data && node.data.uuid === rowUuid
          );
  
          if (newlyAddedNode) {
            const editableColumns = this.gridApi
              .getAllGridColumns()
              .map((col) => {
                const colDef = col.getColDef();
                const colId = col.getColId();
                return colDef.editable ? colId : null;
              })
              .filter((col) => !!col && !rowGroupColumns.includes(col));
  
            // Focus not the first row, but exactly the one that was added
            // Focus the first editable cell that has no respective group
            this.gridApi.startEditingCell({
              rowIndex: newlyAddedNode.rowIndex as number,
              colKey: editableColumns[0]!,
            });
  
            if (prefilledRowData.employeeId) {
              this.getEmployeeAndPrefillPayCodeAndBoardingPoint(
                prefilledRowData.employeeId,
                newlyAddedNode.data,
                newlyAddedNode.rowIndex as number,
                newlyAddedNode.rowIndex
              );
            }
  
            this.gridStateManagementService.addEditedRow(newlyAddedNode);
          }
        }, 0);
      }
      this.gridStateManagementService.emitEnableAddNewRowEvent(false);
    }
  
    subscribeToCopyRow() {
      this.gridStateManagementService.copyRowEmitter
        .pipe(
          untilDestroyed(this),
          tap((id: number) => {
            this.copyRow(false, id);
          })
        )
        .subscribe();
    }
  
    subscribeToCopyRowWithIncrement() {
      this.gridStateManagementService.copyRowWithIncrementEmitter
        .pipe(
          untilDestroyed(this),
          tap((id: number) => {
            this.copyRow(true, id);
          })
        )
        .subscribe();
    }
  
    async calculateQuantityRelatedFieldsForCopiedRow(
      employee: EmployeesInterface,
      copiedItem: TimeRegistrationWithControlsInterface
    ) {
      const prefilledProperties: any = {};
      const { regimeId, payCodeId } = employee;
      const employeeWeeklySchedules =
        this.auxData().weeklySchedules?.filter(
          (item: WeeklySchedulesInterface) => item.regimeId === regimeId
        ) || [];
  
      const determinedWS =
        employeeWeeklySchedules.length > 1
          ? employeeWeeklySchedules.filter(
              (item: WeeklySchedulesInterface) => item.payCodeId == payCodeId
            )
          : employeeWeeklySchedules;
  
      if (determinedWS && determinedWS.length === 1) {
        // Get weekly schedule with periods
        return new Promise((resolve) =>
          this.dataEntryService
            .getWeeklyScheduleById(determinedWS[0].id, this.activeCompanyId()!)
            .pipe(untilDestroyed(this))
            .subscribe((ws) => {
              prefilledProperties.quantity = copiedItem.quantity;
  
              const wsPeriod: WeeklySchedulePeriod =
                this.gridWorkflowService.determineWSPeriodViaDate(
                  copiedItem.date!,
                  ws
                );
  
              if (wsPeriod) {
                const payCodeId = wsPeriod.defaultPayCodeId || wsPeriod.payCodeId;
  
                if (payCodeId) {
                  prefilledProperties.payCodeId = payCodeId;
                }
  
                const paycodeHasValidType = (payCodeId: number): boolean => {
                  const payCode = this.auxData().payCodes?.find(
                    (pay: PaycodeInterface) => pay.id === Number(payCodeId)
                  );
                  return (
                    !!payCode && payCode.typeOfHours !== TypeOfHoursEnum.NotHours
                  );
                };
  
                const canPrefillQuantity =
                  !payCodeId || paycodeHasValidType(payCodeId);
  
                if (canPrefillQuantity) {
                  const defaultQuantity =
                    this.calculateDefaultHoursForEmployeeDate(
                      employee,
                      wsPeriod,
                      copiedItem
                    );
  
                  prefilledProperties.quantity = defaultQuantity;
                  // If default hours are calculated instead of being just copied,
                  // reset startTime, endTime and pause since they no longer make sense
                  ['startTime', 'endTime', 'pause'].forEach((field) => {
                    prefilledProperties[field] = '';
                  });
                }
              }
              return resolve(prefilledProperties);
            })
        );
      } else {
        const employeePayCode = this.auxData().payCodes?.find(
          (pay: PaycodeInterface) => pay.id === Number(employee.payCodeId)
        );
        if (employeePayCode) {
          const formattedUnit: UnitsEnum | string =
            this.gridWorkflowService.getFormattedUnit(
              this.auxData().payCodes,
              payCodeId
            );
          if (formattedUnit === UnitsEnum.Amount) {
            ['startTime', 'endTime', 'pause'].forEach((field) => {
              prefilledProperties[field] = '';
            });
            prefilledProperties['quantity'] = 0;
          }
          return Promise.resolve(prefilledProperties);
        }
      }
    }
  
    async copyRow(withIncrement: boolean = false, id: number) {
      const procedureName =
        this.gridWorkflowService.getCopyProcedureName(withIncrement);
  
      const { isProcedureAllowed, prefilledRowData, errorMessage } =
        this.checkIfGridStateAllowsProcedure(procedureName, withIncrement);
  
      if (!isProcedureAllowed) {
        this.notificationsService.openSnackbar(errorMessage);
        return;
      }
  
      const rowGroupColumns = this.gridApi.getRowGroupColumns().map((col) => {
        const colId = col.getColId();
        return colId;
      });
  
      if (withIncrement && rowGroupColumns.includes('date')) {
        this.notificationsService.openSnackbar(
          this.translations[
            'dataEntry.dataEntryTable.copyingWithIncrementBlockedByDateGroup'
          ]
        );
        return;
      }
  
      const copiedItemCandidate: any = this.findRowById(id);
  
      if (!copiedItemCandidate) return;
  
      const copiedItem: TimeRegistrationWithControlsInterface =
        await this.gridWorkflowService.prepareCopiedItem(
          copiedItemCandidate,
          prefilledRowData,
          withIncrement,
          this.auxData().payCodes,
          this.auxData().employees,
          this.auxData().destinations,
          this.auxData().calendars,
          this.auxData().equipments
        );
  
      if (!copiedItem) return;
  
      // Move to the top of the grid before inserting a new row
      this.gridApi?.ensureIndexVisible(0);
  
      // Prefill quantity related fields
      let quantityProperties = {};
  
      // Recalculate quantity related fields for an employee
      if (copiedItem.employeeOrEquipment.optionType === 'Empl.') {
        const employee = this.auxData().employees.find(
          (empl: EmployeesInterface) =>
            empl.id === copiedItem.employeeOrEquipment.id
        )!;
  
        if (employee) {
          quantityProperties =
            await this.calculateQuantityRelatedFieldsForCopiedRow(
              employee,
              copiedItem
            );
        } else {
          copiedItem.payCodeId = null;
          copiedItem.quantity = null;
          copiedItem.unit = null;
        }
      }
  
      this.gridWorkflowService.updateDateFieldValidations(
        copiedItem,
        copiedItem?.date,
        this.selectedPeriod,
        this.auxData().calendars
      );
  
      const isValid = this.utilityService.checkDateInRange(
        copiedItem?.date as string,
        this.selectedPeriod?.startDate,
        this.selectedPeriod?.endDate
      );
  
      const isDateHoliday = this.utilityService.isDateHoliday(
        copiedItem?.date,
        this.auxData().calendars
      );
  
      const isDateWeekend = this.utilityService.isSelectedDateWeekend(
        copiedItem?.date
      );
  
      if (!isValid) {
        this.addRowToGrid({
          date: copiedItem.date,
          dateControl: copiedItem.dateControl,
          dateIsInvalid: true,
        });
      } else if ((isDateHoliday || isDateWeekend) && withIncrement) {
        this.addRowToGrid({
          ...copiedItem,
          ...quantityProperties,
          mobilityTypeId: null,
          boardingPointId: null,
          displacementDistance: null,
          mobilityDistance: null,
        });
      } else {
        this.addRowToGrid({ ...copiedItem, ...quantityProperties });
      }
    }
  
    private findRowById(id: number) {
      return this.rowData.find((row) => row.id === id);
    }
  
    // Add the row to the grid and manage additional behaviors
    private addRowToGrid(copiedItem: any): void {
      const rowUuid = uuidv4();
      const newRow = {
        id: null,
        uuid: rowUuid,
        hasChanged: true,
        ...generateRowControlsFunction(copiedItem),
        ...copiedItem,
      };
  
      this.rowData.unshift(newRow);
      this.updateRowDataWithControls(this.rowData);
  
      this.gridApi.clearFocusedCell();
      this.gridApi.setGridOption('rowData', this.rowData);
      this.focusNewRow(rowUuid);
      this.gridStateManagementService.emitEnableAddNewRowEvent(false);
    }
  
    // Focus on the newly added row
    private focusNewRow(rowUuid: string) {
      setTimeout(() => {
        const renderedNodes = this.gridApi.getRenderedNodes();
        const newlyAddedNode = renderedNodes.find(
          (node) => node.data?.uuid === rowUuid
        );
        const newlyAddedNodeRowIndex = newlyAddedNode?.rowIndex ?? -1;
        if (newlyAddedNode && newlyAddedNodeRowIndex > -1) {
          // ensure first row and first column visibility
          this.gridApi.ensureIndexVisible(newlyAddedNodeRowIndex);
          this.gridApi.ensureColumnVisible('date', 'middle');
  
          const rowGroupColumns = this.gridApi.getRowGroupColumns().map((col) => {
            const colId = col.getColId();
            return colId;
          });
  
          const editableColumns: string[] = this.gridApi
            .getAllGridColumns()
            .map((col) => {
              const colDef = col.getColDef();
              const colId = col.getColId();
              return colDef.editable ? colId : null;
            })
            .filter((col) => !!col && !rowGroupColumns.includes(col)) as string[];
  
          this.gridApi.setFocusedCell(newlyAddedNodeRowIndex, editableColumns[0]);
          this.gridStateManagementService.addEditedRow(newlyAddedNode);
        }
      }, 0);
    }
  
    // KEYBOARD SHORTCUTS HANDLERS
    // Check if the grid contains group nodes
    checkIfGridContainsRows(): boolean {
      if (!this.agGrid?.gridApi()) return true;
      const renderedRows = this.agGrid.gridApi().getRenderedNodes();
      return renderedRows.some((row: any) => row.group);
    }
  
    copyRowsViaShortcut(withIncrement: boolean = false): void {
      try {
        const selectedRows = this.gridApi?.getSelectedRows();
        const selectedNodes = this.gridApi?.getSelectedNodes();
        if (!selectedRows || selectedRows.length === 0) {
          return;
        }
  
        // If rows are grouped, user is expected to define which group new rows should be added to.
        // Due to that, copying is not possible if selected rows relate to different groups
        const nodeParentIds = new Set(
          selectedNodes.map((node) => node.parent?.id)
        );
        if (nodeParentIds.size > 1) {
          this.notificationsService.openSnackbar(
            this.translations[
              'dataEntry.dataEntryTable.copyingIsPossibleForRowsInSameGroup'
            ]
          );
          return;
        }
  
        selectedRows
          .reverse()
          .forEach((row) => this.copyRow(withIncrement, row.id));
      } catch (e) {
        this.notificationsService.openSnackbar(
          this.translations['dataEntry.dataEntryTable.couldNotCopyRow']
        );
      }
    }
  
    listenAddRowShortcut(): void {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(
          untilDestroyed(this),
          filter((e: KeyboardEvent) => e.altKey && e.code === 'KeyN'),
          filter(() => {
            if (this.periodIsClosed) {
              this.notificationsService.openSnackbar(
                this.translations['dataEntry.dataEntryTable.isReadOnlyMode']
              );
              return false;
            }
            return true;
          }),
          tap((): void => {
            this.onAddNewRow();
          })
        )
        .subscribe();
    }
  
    listenDuplicateRowShortcut(): void {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(
          untilDestroyed(this),
          filter((e: KeyboardEvent) => e.altKey && e.code === 'KeyD'),
          tap((): void => {
            this.copyRowsViaShortcut(false);
          })
        )
        .subscribe();
    }
  
    listenCopyWithIncrementShortcut(): void {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(
          untilDestroyed(this),
          filter((e: KeyboardEvent) => e.altKey && e.code === 'KeyI'),
          tap((): void => {
            this.copyRowsViaShortcut(true);
          })
        )
        .subscribe();
    }
  
    listenSaveAllShortcut(): void {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(
          untilDestroyed(this),
          filter((e: KeyboardEvent) => e.altKey && e.code === 'KeyS'),
          tap((): void => {
            this.saveAllChanges();
          })
        )
        .subscribe();
    }
  
    listenDiscardAllShortcut(): void {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(
          untilDestroyed(this),
          filter((e: KeyboardEvent) => e.altKey && e.code === 'KeyZ'),
          tap((): void => {
            this.discardAllChanges();
          })
        )
        .subscribe();
    }
  
    listenDeleteRowShortcut(): void {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(
          untilDestroyed(this),
          filter((e: KeyboardEvent) => e.altKey && e.code === 'Backspace'),
          tap((): void => {
            this.deleteSelectedRowViaShortcut();
          })
        )
        .subscribe();
    }
  
    deleteSelectedRowViaShortcut(): void {
      const editedAndNoTSavedRows =
        this.gridStateManagementService.getEditedRows();
      if (editedAndNoTSavedRows.length > 0) {
        this.notificationsService.openSnackbar(
          this.translations['dataEntry.dataEntryTable.saveChangesBeforeDeleting']
        );
        return;
      }
  
      try {
        const selectedRows = this.gridApi?.getSelectedRows();
        if (!selectedRows) {
          return;
        }
        if (selectedRows.length === 1) {
          const row = selectedRows[0];
          if (row.id) {
            this.dataEntryService
              .deleteTimeRegistration(row.id, this.activeCompanyId()!)
              .pipe(
                untilDestroyed(this),
                tap(() => {
                  this.gridStateManagementService.emitDeletedRow(row.id);
                  this.notificationsService.openSnackbar(
                    this.translations['dataEntry.dataEntryTable.itemDeleted']
                  );
                }),
                catchError((err) => {
                  this.notificationsService.openSnackbar(err?.error?.title);
                  return err;
                })
              )
              .subscribe(() => {});
          } else {
            this.rowData.shift();
            this.gridStateManagementService.updateRowData(this.rowData);
          }
        } else {
          this.notificationsService.openSnackbar(
            this.translations['dataEntry.dataEntryTable.selectOneRow']
          );
        }
      } catch (e) {
        this.notificationsService.openSnackbar(
          this.translations['dataEntry.dataEntryTable.couldNotDeleteRow']
        );
      }
    }
  
    ngOnDestroy() {
      if (this.globalClickListener) {
        this.globalClickListener();
      }
      this.gridStateManagementService.clearUnsavedChanges();
    }
  
    getEditedRows() {
      return this.gridStateManagementService.getEditedRows();
    }
  
    discardAllChanges() {
      this.gridStateManagementService.onDiscardAllChanges();
      this.onChangesDiscarded.emit();
    }
  
    saveAllChanges() {
      this.gridStateManagementService.onSaveAllChanges().subscribe((data) => {
        const uuids = Object.keys(this.gridContext.rowStatuses);
        const itemsToUpdate: any[] = [];
        this.gridApi!.forEachNodeAfterFilterAndSort(function (rowNode) {
          const data = rowNode.data;
          if (data && uuids.includes(data.uuid)) {
            itemsToUpdate.push(data);
          }
        });
  
        this.gridApi.applyTransaction({ update: itemsToUpdate })!;
  
        if (!data.includes('error')) {
          this.onChangesSaved.emit();
        }
      });
    }
  
    getRowId(params: any) {
      return params.data.uuid;
    }
  }
  