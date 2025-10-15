const json = window.etl.stopLogging();
// If you use Task Builder (Code), append to the row:
gorilla.task.save('etl_json', json);   // or gorilla.metric('etl_json', json);
// …then advance
gorilla.finish();